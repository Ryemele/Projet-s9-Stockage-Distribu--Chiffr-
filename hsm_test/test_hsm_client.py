"""
Script de test pour le serveur HSM avec PyUmbral
Simule Alice qui chiffre un fichier et Bob qui y accède après autorisation
"""

import requests
import base64
from umbral import SecretKey, Signer, encrypt, decrypt_original, generate_kfrags, decrypt_reencrypted, Capsule, PublicKey, CapsuleFrag

# Configuration
BASE_URL = "http://127.0.0.1:8000"

def b64_encode(data: bytes) -> str:
    """Encode des bytes en base64 string"""
    return base64.b64encode(data).decode('utf-8')

def b64_decode(data: str) -> bytes:
    """Decode une base64 string en bytes"""
    return base64.b64decode(data)


print("=" * 60)
print("TEST DU SERVEUR HSM - Proxy Re-Encryption avec Umbral")
print("=" * 60)

# ============================================================================
# ÉTAPE 1 : GÉNÉRATION DES CLÉS POUR ALICE ET BOB
# ============================================================================
print("\n[ÉTAPE 1] Génération des clés cryptographiques...")

# Clés d'Alice (propriétaire du fichier)
alices_secret_key = SecretKey.random()
alices_public_key = alices_secret_key.public_key()
alices_signing_key = SecretKey.random()
alices_signer = Signer(alices_signing_key)
alices_verifying_key = alices_signing_key.public_key()

print(f"✓ Clés d'Alice générées")

# Clés de Bob (destinataire)
bobs_secret_key = SecretKey.random()
bobs_public_key = bobs_secret_key.public_key()

print(f"✓ Clés de Bob générées")

# ============================================================================
# ÉTAPE 2 : ENREGISTREMENT DES UTILISATEURS SUR LE SERVEUR
# ============================================================================
print("\n[ÉTAPE 2] Enregistrement des utilisateurs sur le serveur HSM...")

# Enregistrer Alice
response = requests.post(
    f"{BASE_URL}/users/register",
    json={
        "username": "alice",
        "public_key_b64": b64_encode(bytes(alices_public_key)),
        "verifying_key_b64": b64_encode(bytes(alices_verifying_key))
    }
)
print(f"✓ Alice enregistrée: {response.json()['message']}")

# Enregistrer Bob
response = requests.post(
    f"{BASE_URL}/users/register",
    json={
        "username": "bob",
        "public_key_b64": b64_encode(bytes(bobs_public_key)),
        "verifying_key_b64": b64_encode(bytes(bobs_public_key))  # Simplification pour le test
    }
)
print(f"✓ Bob enregistré: {response.json()['message']}")

# ============================================================================
# ÉTAPE 3 : ALICE CHIFFRE UN FICHIER
# ============================================================================
print("\n[ÉTAPE 3] Alice chiffre un fichier...")

plaintext = b"Ceci est un message secret d'Alice pour Bob!"
print(f"Message original: {plaintext.decode('utf-8')}")

# Chiffrement avec la clé publique d'Alice
capsule, ciphertext = encrypt(alices_public_key, plaintext)
print(f"✓ Fichier chiffré (taille ciphertext: {len(ciphertext)} bytes)")

# Alice peut déchiffrer son propre message
alice_cleartext = decrypt_original(alices_secret_key, capsule, ciphertext)
assert alice_cleartext == plaintext
print(f"✓ Alice peut déchiffrer: {alice_cleartext.decode('utf-8')}")

# ============================================================================
# ÉTAPE 4 : ALICE UPLOAD LES MÉTADONNÉES SUR LE SERVEUR
# ============================================================================
print("\n[ÉTAPE 4] Alice envoie les métadonnées au serveur...")

file_id = "secret_file_123"
response = requests.post(
    f"{BASE_URL}/files/upload",
    headers={"Authorization": "Bearer alice"},
    json={
        "file_id": file_id,
        "capsule_b64": b64_encode(bytes(capsule)),
        "ciphertext_b64": b64_encode(ciphertext)
    }
)
print(f"✓ Métadonnées uploadées: {response.json()['message']}")

# ============================================================================
# ÉTAPE 5 : ALICE GÉNÈRE LES KFRAGS POUR AUTORISER BOB
# ============================================================================
print("\n[ÉTAPE 5] Alice génère les clés de transformation pour Bob...")

threshold = 10  # Nombre minimum de fragments nécessaires
shares = 20     # Nombre total de fragments générés

kfrags = generate_kfrags(
    delegating_sk=alices_secret_key,
    receiving_pk=bobs_public_key,
    signer=alices_signer,
    threshold=threshold,
    shares=shares
)
print(f"✓ {shares} KFrags générés (seuil: {threshold})")

# ============================================================================
# ÉTAPE 6 : ALICE AUTORISE BOB SUR LE SERVEUR
# ============================================================================
print("\n[ÉTAPE 6] Alice autorise Bob à accéder au fichier...")

response = requests.post(
    f"{BASE_URL}/sharing/grant_access",
    headers={"Authorization": "Bearer alice"},
    json={
        "file_id": file_id,
        "grantee_username": "bob",
        "kfrags_b64": [b64_encode(bytes(kfrag)) for kfrag in kfrags],
        "threshold": threshold
    }
)
print(f"✓ Accès accordé: {response.json()['message']}")

# ============================================================================
# ÉTAPE 7 : BOB DEMANDE L'ACCÈS AU FICHIER
# ============================================================================
print("\n[ÉTAPE 7] Bob demande l'accès au fichier...")

response = requests.get(
    f"{BASE_URL}/files/download_info/{file_id}",
    headers={"Authorization": "Bearer bob"}
)

if response.status_code != 200:
    print(f"❌ Erreur: {response.json()}")
    exit(1)

download_info = response.json()
print(f"✓ Informations de téléchargement reçues")
print(f"  - Nombre de cfrags reçus: {len(download_info['cfrags_b64'])}")

# ============================================================================
# ÉTAPE 8 : BOB DÉCHIFFRE LE FICHIER
# ============================================================================
print("\n[ÉTAPE 8] Bob déchiffre le fichier...")

# Désérialiser les données de base
capsule_from_server = Capsule.from_bytes(b64_decode(download_info['capsule_b64']))
ciphertext_from_server = b64_decode(download_info['ciphertext_b64'])

# Désérialiser les clés d'Alice
alices_public_key_from_server = PublicKey.from_bytes(b64_decode(download_info['delegating_pk_b64']))
alices_verifying_key_from_server = PublicKey.from_bytes(b64_decode(download_info['verifying_pk_b64']))

# Désérialiser les CFrags
cfrags = [CapsuleFrag.from_bytes(b64_decode(cfrag_b64)) for cfrag_b64 in download_info['cfrags_b64']]
print(f"  - {len(cfrags)} cfrags reçus du serveur")

# IMPORTANT: Vérifier les CFrags avant de les utiliser
print(f"  - Vérification des cfrags...")
verified_cfrags = []
for i, cfrag in enumerate(cfrags):
    verified_cfrag = cfrag.verify(
        capsule=capsule_from_server,
        verifying_pk=alices_verifying_key_from_server,
        delegating_pk=alices_public_key_from_server,
        receiving_pk=bobs_public_key
    )
    verified_cfrags.append(verified_cfrag)
    print(f"    ✓ CFrag {i+1}/{len(cfrags)} vérifié")

# Déchiffrer avec les cfrags vérifiés
bob_cleartext = decrypt_reencrypted(
    receiving_sk=bobs_secret_key,
    delegating_pk=alices_public_key_from_server,
    capsule=capsule_from_server,
    verified_cfrags=verified_cfrags,
    ciphertext=ciphertext_from_server
)

print(f"✓ Bob a déchiffré avec succès!")
print(f"  Message déchiffré: {bob_cleartext.decode('utf-8')}")

# ============================================================================
# VÉRIFICATION FINALE
# ============================================================================
print("\n" + "=" * 60)
if bob_cleartext == plaintext:
    print("✅ TEST RÉUSSI! Bob a bien reçu le message d'Alice")
    print("   Le proxy re-encryption fonctionne correctement!")
else:
    print("❌ TEST ÉCHOUÉ! Les messages ne correspondent pas")

print("=" * 60)

# ============================================================================
# ÉTAPE BONUS : TESTER UN ACCÈS NON AUTORISÉ
# ============================================================================
print("\n[BONUS] Test d'accès non autorisé (Charlie tente d'accéder)...")

response = requests.get(
    f"{BASE_URL}/files/download_info/{file_id}",
    headers={"Authorization": "Bearer charlie"}
)

if response.status_code == 403:
    print(f"✓ Accès refusé correctement: {response.json()['detail']}")
else:
    print(f"⚠️  Attention: Charlie devrait être refusé!")

print("\n✅ Tous les tests sont terminés!")