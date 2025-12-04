# backend/hsm/main.py
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List

# Import de notre logique découplée
import logic

app = FastAPI(
    title="HSM Service",
    description="Service de gestion des clés et Proxy Re-Encryption (Umbral)"
)

# --- Modèles Pydantic ---

class UserRegistrationRequest(BaseModel):
    username: str
    public_key_b64: str
    verifying_key_b64: str

class FileUploadRequest(BaseModel):
    file_id: str
    capsule_b64: str
    ciphertext_b64: str

class GrantAccessRequest(BaseModel):
    file_id: str
    grantee_username: str
    kfrags_b64: List[str]
    threshold: int

class DownloadInfoResponse(BaseModel):
    file_id: str
    capsule_b64: str
    cfrags_b64: List[str]
    ciphertext_b64: str
    delegating_pk_b64: str
    verifying_pk_b64: str

# --- Dépendances ---

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    username = authorization.split(" ")[1]
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    return username

# --- Routes API ---

@app.post("/users/register", status_code=201)
async def register_user(request: UserRegistrationRequest):
    logic.register_user_keys(
        request.username, 
        request.public_key_b64, 
        request.verifying_key_b64
    )
    return {"message": f"Utilisateur {request.username} enregistré"}

@app.post("/files/upload", status_code=201)
async def upload_file_metadata(
    request: FileUploadRequest,
    current_user: str = Depends(get_current_user)
):
    logic.store_file_metadata(
        request.file_id, 
        current_user, 
        request.capsule_b64, 
        request.ciphertext_b64
    )
    return {"message": "Métadonnées sécurisées enregistrées"}

@app.post("/sharing/grant_access")
async def grant_access_route(
    request: GrantAccessRequest,
    current_user: str = Depends(get_current_user)
):
    # Vérification propriétaire
    metadata = logic.get_file_metadata(request.file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Fichier inconnu")
    if metadata["owner"] != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé (Propriétaire uniquement)")

    # Vérification destinataire
    if not logic.get_user_keys(request.grantee_username):
        raise HTTPException(status_code=404, detail="Destinataire inconnu")

    logic.grant_access(
        request.file_id, 
        request.grantee_username, 
        request.kfrags_b64, 
        request.threshold
    )
    return {"message": f"Accès accordé à {request.grantee_username}"}

@app.get("/files/download_info/{file_id}", response_model=DownloadInfoResponse)
async def get_download_info(
    file_id: str,
    current_user: str = Depends(get_current_user)
):
    try:
        result = logic.perform_reencryption(file_id, current_user)
        return DownloadInfoResponse(**result)
    
    except PermissionError:
        raise HTTPException(status_code=403, detail="Accès refusé: Pas de permission partagée")
    except ValueError as e:
        # Erreurs de validation ou données manquantes
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Erreur interne crypto: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne lors du re-chiffrement")

@app.get("/users/{username}/public_key")
async def get_public_key(username: str):
    keys = logic.get_user_keys(username)
    if not keys:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return {
        "username": username, 
        **keys
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)