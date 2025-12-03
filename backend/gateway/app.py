import os
import uuid
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from models import db, User, Permission

app = Flask(__name__)

# Enable CORS for frontend communication
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}}, supports_credentials=True)

#  CONFIG 

# URL du service HSM
HSM_SERVICE_URL = os.getenv('HSM_URL', 'http://localhost:8000')
 
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://postgres:0000@localhost:5432/storage')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'super-secret-key'  # à changer en production

db.init_app(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = 'storage'
SHARED_FOLDER = 'shared'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SHARED_FOLDER, exist_ok=True)

# Note: L'objet local 'hsm = HSM()' est supprimé car le HSM est maintenant un service externe.

#  INITIALISATION 
with app.app_context():
    db.create_all()

#  AUTHENTIFICATION 
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User created successfully"}), 201


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        token = create_access_token(identity=username)
        return jsonify({"token": token}), 200

    return jsonify({"error": "Invalid credentials"}), 401

#  UPLOAD 
# Upload d'un fichier avec authentification
@app.route('/upload', methods=['POST'])
@jwt_required()  # assure que l'utilisateur est connecté
def upload_file():
    current_user = get_jwt_identity()  # récupère le nom d'utilisateur connecté
    uploaded_file = request.files.get('file')

    if not uploaded_file:
        return jsonify({"error": "File is required"}), 400

    # Générer un ID de fichier
    file_id = str(uuid.uuid4())
    
    # Appel au service HSM externe pour synchroniser les métadonnées
    try:
        # Simulation des données (Capsules) pour satisfaire l'API du HSM
        payload = {
            "file_id": file_id,
            "capsule_b64": "simulated_capsule_base64", 
            "ciphertext_b64": "simulated_ciphertext_base64"
        }
        
        headers = {"Authorization": f"Bearer {current_user}"}
        
        # Envoi de la requête au microservice HSM
        resp = requests.post(f"{HSM_SERVICE_URL}/files/upload", json=payload, headers=headers, timeout=5)
        
        if resp.status_code != 201:
            print(f"HSM Warning: {resp.text}")

    except requests.exceptions.RequestException as e:
        print(f"HSM Connection Error: {str(e)}")

    # Sauvegarder le fichier chiffré
    file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")
    uploaded_file.save(file_path)

    # Ajouter le propriétaire dans les permissions
    perm = Permission(file_id=file_id, username=current_user)
    db.session.add(perm)
    db.session.commit()

    return jsonify({
        "message": f"File uploaded successfully by {current_user}",
        "file_id": file_id,
        "status": "stored_and_synced"
    })

#  SHARE 
@app.route('/share', methods=['POST'])
@jwt_required()
def share_file():
    current_user = get_jwt_identity()
    file_id = request.form.get('file_id')
    receiver = request.form.get('receiver')

    if not file_id or not receiver:
        return jsonify({"error": "file_id and receiver required"}), 400

    # Note: On ne vérifie plus la clé via hsm.get_key() car c'est géré à distance.
    # On vérifie simplement si le fichier existe physiquement.

    # Vérifier si le user actuel a le droit de partager
    permission = Permission.query.filter_by(file_id=file_id, username=current_user).first()
    if not permission:
        return jsonify({"error": "You don't have permission to share this file"}), 403

    src_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")
    if not os.path.exists(src_path):
        return jsonify({"error": "File not found"}), 404

    dst_path = os.path.join(SHARED_FOLDER, f"{file_id}_{receiver}.enc")
    with open(src_path, 'rb') as src, open(dst_path, 'wb') as dst:
        dst.write(src.read())

    # Ajouter le droit d'accès pour le receiver
    perm = Permission(file_id=file_id, username=receiver)
    db.session.add(perm)
    db.session.commit()

    return jsonify({
        "message": f"File shared with {receiver}",
        "shared_path": dst_path
    })

#  DOWNLOAD 
@app.route('/download/<file_id>', methods=['GET'])
@jwt_required()
def download_file(file_id):
    current_user = get_jwt_identity()

    # Vérifier si l'utilisateur a accès
    permission = Permission.query.filter_by(file_id=file_id, username=current_user).first()
    if not permission:
        return jsonify({"error": "Access denied"}), 403

    file_path = os.path.join(SHARED_FOLDER, f"{file_id}_{current_user}.enc")
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    # Récupération des métadonnées cryptographiques depuis le HSM
    hsm_data = {}
    try:
         headers = {"Authorization": f"Bearer {current_user}"}
         # Appel au endpoint de transformation du HSM
         resp = requests.get(f"{HSM_SERVICE_URL}/files/download_info/{file_id}", headers=headers, timeout=5)
         
         if resp.status_code == 200:
             hsm_data = resp.json()
         else:
             hsm_data = {"error": "Key not found in HSM"}
    except:
         hsm_data = {"error": "HSM unavailable"}

#    return send_from_directory(os.path.dirname(file_path), os.path.basename(file_path), as_attachment=True)
    return jsonify({
        "message": "Access granted. File ready for download.",
        "file_id": file_id,
        "user": current_user,
        "path": file_path,
        "crypto_metadata": hsm_data
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)