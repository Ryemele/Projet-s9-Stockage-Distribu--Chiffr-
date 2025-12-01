import uvicorn
import base64
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List

# --- Importations de Umbral (nouvelle API) ---
from umbral import SecretKey, PublicKey, Signer, encrypt, decrypt_original, generate_kfrags, reencrypt, decrypt_reencrypted, Capsule, KeyFrag

# --- Notre "HSM Logiciel" / "Service Central" ---
app = FastAPI(
    title="HSM Logiciel",
    description="API pour la gestion des métadonnées et le re-chiffrement (PRE)"
)

# --- Bases de données en mémoire (pour ce PoC) ---
# 1. Base des métadonnées de fichiers
#    Format: file_metadata_db[file_id] = {"owner": "alice", "capsule": b"...", "ciphertext": b"..."}
file_metadata_db = {}

# 2. Base des permissions (stocke les clés de transformation)
#    Format: permissions_db[(file_id, grantee_user)] = [b"kfrag1", b"kfrag2", ...]
permissions_db = {}

# 3. Base des clés publiques des utilisateurs (pour la vérification)
#    Format: user_keys_db[username] = {"public_key": b"...", "verifying_key": b"..."}
user_keys_db = {}


# --- Simulation de votre système d'authentification ---
async def get_current_user(authorization: str = Header(...)):
    """
    Simule la validation d'un token d'authentification.
    Dans un vrai projet, vous vérifieriez un JWT ici.
    Pour ce PoC, nous supposons que le token est juste le nom de l'utilisateur.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    
    username = authorization.split(" ")[1]
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return username


# --- Modèles de Données (Pydantic) ---

class UserRegistrationRequest(BaseModel):
    """
    Modèle pour l'enregistrement des clés publiques d'un utilisateur.
    """
    username: str
    public_key_b64: str
    verifying_key_b64: str

class FileUploadRequest(BaseModel):
    """
    Modèle pour la Phase 2 : Alice envoie les métadonnées après avoir chiffré.
    """
    file_id: str
    capsule_b64: str      # Capsule encodée en Base64
    ciphertext_b64: str   # Ciphertext encodé en Base64

class GrantAccessRequest(BaseModel):
    """
    Modèle pour la Phase 3 : Alice envoie la clé de transformation.
    """
    file_id: str
    grantee_username: str
    kfrags_b64: List[str]  # Liste de KFrags encodés en Base64
    threshold: int         # Nombre minimum de cfrags nécessaires

class DownloadInfoResponse(BaseModel):
    """
    Modèle pour la Phase 4 : Le serveur renvoie à Bob de quoi déchiffrer.
    """
    file_id: str
    capsule_b64: str       # Capsule originale
    cfrags_b64: List[str]  # Liste de cfrags transformés
    ciphertext_b64: str    # Ciphertext original
    delegating_pk_b64: str # Clé publique d'Alice (nécessaire pour déchiffrement)
    verifying_pk_b64: str  # Clé de vérification d'Alice


# --- Fonctions Utilitaires (Base64) ---
def b64_to_capsule(capsule_b64: str) -> Capsule:
    return Capsule.from_bytes(base64.b64decode(capsule_b64))

def b64_to_public_key(pk_b64: str) -> PublicKey:
    return PublicKey.from_bytes(base64.b64decode(pk_b64))


# --- API Endpoints du "HSM Logiciel" ---

@app.post("/users/register", status_code=201)
async def register_user(request: UserRegistrationRequest):
    """
    PHASE 1 : Enregistrement des clés publiques d'un utilisateur.
    """
    user_keys_db[request.username] = {
        "public_key_b64": request.public_key_b64,
        "verifying_key_b64": request.verifying_key_b64
    }
    return {"message": f"Utilisateur {request.username} enregistré avec succès"}


@app.post("/files/upload", status_code=201)
async def upload_file_metadata(
    request: FileUploadRequest,
    current_user: str = Depends(get_current_user)
):
    """
    PHASE 2 : Alice notifie le serveur d'un nouveau fichier.
    Elle envoie les métadonnées (Capsule, Ciphertext) après chiffrement local.
    """
    file_metadata_db[request.file_id] = {
        "owner": current_user,
        "capsule_b64": request.capsule_b64,
        "ciphertext_b64": request.ciphertext_b64
    }
    return {"message": f"Métadonnées du fichier {request.file_id} stockées pour {current_user}"}


@app.post("/sharing/grant_access")
async def grant_access(
    request: GrantAccessRequest,
    current_user: str = Depends(get_current_user)
):
    """
    PHASE 3 : Alice autorise le partage avec un autre utilisateur.
    Elle envoie les KFrags (clés de transformation) générés localement.
    """
    # Vérifier qu'Alice est bien propriétaire du fichier
    metadata = file_metadata_db.get(request.file_id)
    if not metadata or metadata["owner"] != current_user:
        raise HTTPException(status_code=403, detail="Accès interdit: Vous n'êtes pas propriétaire")

    # Vérifier que le destinataire existe
    if request.grantee_username not in user_keys_db:
        raise HTTPException(status_code=404, detail=f"Utilisateur {request.grantee_username} non trouvé")

    # Stocker la clé de transformation
    permission_key = (request.file_id, request.grantee_username)
    permissions_db[permission_key] = {
        "kfrags_b64": request.kfrags_b64,
        "threshold": request.threshold
    }
    
    return {
        "message": f"Accès au fichier {request.file_id} accordé à {request.grantee_username}"
    }


@app.get("/files/download_info/{file_id}", response_model=DownloadInfoResponse)
async def get_download_info(
    file_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    PHASE 4 : Bob demande à accéder au fichier.
    Le serveur effectue la transformation de clé.
    """
    print(f"Utilisateur '{current_user}' demande l'accès au fichier '{file_id}'")
    
    # 1. Vérifier les permissions
    permission_key = (file_id, current_user)
    permission_data = permissions_db.get(permission_key)
    
    if not permission_data:
        raise HTTPException(status_code=403, detail="Accès interdit: Partage non autorisé")

    # 2. Récupérer les métadonnées d'origine (d'Alice)
    metadata = file_metadata_db.get(file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    try:
        # 3. Opération de Transformation (Le "Re-chiffrement")
        capsule = b64_to_capsule(metadata["capsule_b64"])
        
        # Récupérer les clés du propriétaire et du destinataire
        owner = metadata["owner"]
        owner_keys = user_keys_db.get(owner)
        if not owner_keys:
            raise HTTPException(status_code=500, detail="Clés du propriétaire non trouvées")
        
        recipient_keys = user_keys_db.get(current_user)
        if not recipient_keys:
            raise HTTPException(status_code=500, detail="Clés du destinataire non trouvées")
        
        # Désérialiser les clés publiques
        delegating_pk = b64_to_public_key(owner_keys["public_key_b64"])
        verifying_pk = b64_to_public_key(owner_keys["verifying_key_b64"])
        receiving_pk = b64_to_public_key(recipient_keys["public_key_b64"])
        
        # Désérialiser et vérifier les kfrags
        kfrags_b64 = permission_data["kfrags_b64"]
        threshold = permission_data["threshold"]
        
        # Générer les cfrags (capsule fragments)
        cfrags = []
        for kfrag_b64 in kfrags_b64[:threshold]:
            # Désérialiser le kfrag
            kfrag = KeyFrag.from_bytes(base64.b64decode(kfrag_b64))
            
            # Vérifier le kfrag pour obtenir un VerifiedKeyFrag
            verified_kfrag = kfrag.verify(
                verifying_pk=verifying_pk,
                delegating_pk=delegating_pk,
                receiving_pk=receiving_pk
            )
            
            # Effectuer le re-chiffrement
            cfrag = reencrypt(capsule=capsule, kfrag=verified_kfrag)
            cfrags.append(cfrag)
        
        print(f"Transformation Réussie : {len(cfrags)} cfrags générés pour {current_user}")

        # 4. Créer la réponse pour Bob
        return DownloadInfoResponse(
            file_id=file_id,
            capsule_b64=metadata["capsule_b64"],
            cfrags_b64=[base64.b64encode(bytes(cfrag)).decode('utf-8') for cfrag in cfrags],
            ciphertext_b64=metadata["ciphertext_b64"],
            delegating_pk_b64=owner_keys["public_key_b64"],
            verifying_pk_b64=owner_keys["verifying_key_b64"]
        )

    except Exception as e:
        print(f"Erreur de re-chiffrement: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur cryptographique: {str(e)}")


@app.get("/users/{username}/public_key")
async def get_user_public_key(username: str):
    """
    Récupérer la clé publique d'un utilisateur.
    """
    user_keys = user_keys_db.get(username)
    if not user_keys:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    return {
        "username": username,
        "public_key_b64": user_keys["public_key_b64"],
        "verifying_key_b64": user_keys["verifying_key_b64"]
    }


# --- Point d'entrée pour lancer le serveur ---
if __name__ == "__main__":
    print("Lancement du HSM Logiciel sur http://127.0.0.1:8000")
    print("Documentation API disponible sur http://127.0.0.1:8000/docs")
    uvicorn.run(app, host="127.0.0.1", port=8000)