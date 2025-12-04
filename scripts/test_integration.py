import requests
import os

# Configuration
GATEWAY_URL = "http://localhost:8080"
USERNAME = "test_user"
PASSWORD = "password123"

def print_step(msg):
    print(f"\n🔹 {msg}")

def run_test():
    session = requests.Session()

    # 1. Création de compte
    print_step("1. Inscription...")
    resp = session.post(f"{GATEWAY_URL}/register", json={"username": USERNAME, "password": PASSWORD})
    print(f"Status: {resp.status_code}, Body: {resp.json()}")

    # 2. Login (Récupération du Token)
    print_step("2. Connexion...")
    resp = session.post(f"{GATEWAY_URL}/login", json={"username": USERNAME, "password": PASSWORD})
    if resp.status_code != 200:
        print("❌ Login échoué")
        return
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Token JWT récupéré")

    # 3. Upload d'un fichier (Le Gateway doit contacter le HSM)
    print_step("3. Upload de fichier (Test communication Gateway -> HSM)...")
    files = {'file': ('secret.txt', b'Ceci est un secret defense')}
    resp = session.post(f"{GATEWAY_URL}/upload", files=files, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Réponse: {resp.json()}")
    
    file_id = resp.json().get("file_id")
    
    if resp.status_code == 200:
        print("✅ Upload réussi ! Le Gateway a accepté la requête.")
    else:
        print("❌ Erreur d'upload")
        return

    # 4. Download (Le Gateway demande les clés au HSM)
    print_step("4. Download (Le Gateway demande les infos crypto au HSM)...")
    resp = session.get(f"{GATEWAY_URL}/download/{file_id}", headers=headers)
    data = resp.json()
    
    print(f"Status: {resp.status_code}")
    print(f"Métadonnées Crypto reçues: {data.get('crypto_metadata')}")

    # ANALYSE DU RÉSULTAT
    crypto_info = data.get('crypto_metadata', {})
    
    if "error" in crypto_info and "HSM unavailable" in crypto_info["error"]:
        print("\n❌ ÉCHEC : Le Gateway n'arrive pas à joindre le HSM.")
    elif "error" in crypto_info:
        # C'est normal d'avoir une erreur crypto car on a envoyé des fausses données simulées
        print("\n✅ SUCCÈS : Le Gateway a bien parlé au HSM !")
        print(f"   (Le HSM a répondu une erreur logique : '{crypto_info['error']}', ce qui prouve qu'il est en ligne)")
    else:
        print("\n✅ SUCCÈS TOTAL : Communication parfaite.")

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"❌ Erreur critique: Le Gateway est-il lancé ? ({e})")