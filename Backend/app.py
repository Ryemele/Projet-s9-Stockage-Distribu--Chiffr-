from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from models import db, User, Permission
from hsm import HSM
import os
import uuid

app = Flask(__name__)

#  CONFIG 
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:0000@localhost:5432/storage'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'super-secret-key'  # à changer en production

db.init_app(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = 'storage'
SHARED_FOLDER = 'shared'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SHARED_FOLDER, exist_ok=True)

hsm = HSM()

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

    # Générer un ID de fichier et une clé
    file_id = str(uuid.uuid4())
    encryption_key = hsm.generate_key()
    hsm.store_key(file_id, encryption_key)

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
        "encryption_key": encryption_key  # (pour test seulement, à ne pas renvoyer en prod)
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

    key = hsm.get_key(file_id)
    if not key:
        return jsonify({"error": "File not found"}), 404

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

#    return send_from_directory(os.path.dirname(file_path), os.path.basename(file_path), as_attachment=True)
    return jsonify({
        "message": "Access granted. File ready for download.",
        "file_id": file_id,
        "user": current_user,
        "path": file_path
    }), 200

if __name__ == '__main__':
    app.run(debug=True)
