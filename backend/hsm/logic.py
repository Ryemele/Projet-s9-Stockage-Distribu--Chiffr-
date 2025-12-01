# backend/hsm/logic.py
import base64
from typing import List, Optional, Dict, Tuple
from umbral import (
    Capsule, PublicKey, KeyFrag, 
    reencrypt, VerifiedKeyFrag
)

# --- Pseudo-Bases de données (En mémoire) ---
# Dans un vrai système, remplace ceci par des appels à PostgreSQL/Redis
file_metadata_db: Dict[str, dict] = {}       # file_id -> {owner, capsule, ciphertext}
permissions_db: Dict[Tuple[str, str], dict] = {}  # (file_id, grantee) -> {kfrags, threshold}
user_keys_db: Dict[str, dict] = {}           # username -> {public_key, verifying_key}

# --- Utilitaires de conversion ---
def _b64_to_capsule(capsule_b64: str) -> Capsule:
    return Capsule.from_bytes(base64.b64decode(capsule_b64))

def _b64_to_public_key(pk_b64: str) -> PublicKey:
    return PublicKey.from_bytes(base64.b64decode(pk_b64))

def _b64_encode(data: bytes) -> str:
    return base64.b64encode(data).decode('utf-8')

# --- Logique Métier ---

def register_user_keys(username: str, public_key_b64: str, verifying_key_b64: str):
    """Stocke les clés publiques d'un utilisateur."""
    user_keys_db[username] = {
        "public_key_b64": public_key_b64,
        "verifying_key_b64": verifying_key_b64
    }

def get_user_keys(username: str) -> Optional[dict]:
    return user_keys_db.get(username)

def store_file_metadata(file_id: str, owner: str, capsule_b64: str, ciphertext_b64: str):
    """Enregistre les métadonnées d'un fichier chiffré."""
    file_metadata_db[file_id] = {
        "owner": owner,
        "capsule_b64": capsule_b64,
        "ciphertext_b64": ciphertext_b64
    }

def get_file_metadata(file_id: str) -> Optional[dict]:
    return file_metadata_db.get(file_id)

def grant_access(file_id: str, grantee_username: str, kfrags_b64: List[str], threshold: int):
    """Stocke les fragments de clé (KFrags) pour un partage."""
    key = (file_id, grantee_username)
    permissions_db[key] = {
        "kfrags_b64": kfrags_b64,
        "threshold": threshold
    }

def check_access(file_id: str, grantee_username: str) -> Optional[dict]:
    return permissions_db.get((file_id, grantee_username))

def perform_reencryption(file_id: str, grantee_username: str) -> dict:
    """
    Cœur du système : Transforme les KFrags en CFrags pour le destinataire.
    """
    # 1. Récupérations des données
    metadata = get_file_metadata(file_id)
    if not metadata:
        raise ValueError("Fichier non trouvé")
        
    permission = check_access(file_id, grantee_username)
    if not permission:
        raise PermissionError("Accès non autorisé")
        
    owner_username = metadata["owner"]
    owner_keys = get_user_keys(owner_username)
    recipient_keys = get_user_keys(grantee_username)
    
    if not owner_keys or not recipient_keys:
        raise ValueError("Clés utilisateur manquantes")

    # 2. Désérialisation cryptographique
    try:
        capsule = _b64_to_capsule(metadata["capsule_b64"])
        delegating_pk = _b64_to_public_key(owner_keys["public_key_b64"])
        verifying_pk = _b64_to_public_key(owner_keys["verifying_key_b64"])
        receiving_pk = _b64_to_public_key(recipient_keys["public_key_b64"])
    except Exception as e:
        raise ValueError(f"Erreur de décodage des clés/capsules: {e}")

    # 3. Génération des CFrags (Re-Encryption)
    kfrags_b64 = permission["kfrags_b64"]
    threshold = permission["threshold"]
    
    cfrags = []
    # On utilise juste le nombre nécessaire de fragments (threshold)
    for kfrag_b64 in kfrags_b64[:threshold]:
        kfrag = KeyFrag.from_bytes(base64.b64decode(kfrag_b64))
        
        # Vérification critique du KFrag
        verified_kfrag: VerifiedKeyFrag = kfrag.verify(
            verifying_pk=verifying_pk,
            delegating_pk=delegating_pk,
            receiving_pk=receiving_pk
        )
        
        # Transformation
        cfrag = reencrypt(capsule=capsule, kfrag=verified_kfrag)
        cfrags.append(cfrag)

    # 4. Construction de la réponse
    return {
        "file_id": file_id,
        "capsule_b64": metadata["capsule_b64"],
        "cfrags_b64": [_b64_encode(bytes(cf)) for cf in cfrags],
        "ciphertext_b64": metadata["ciphertext_b64"],
        "delegating_pk_b64": owner_keys["public_key_b64"],
        "verifying_pk_b64": owner_keys["verifying_key_b64"]
    }