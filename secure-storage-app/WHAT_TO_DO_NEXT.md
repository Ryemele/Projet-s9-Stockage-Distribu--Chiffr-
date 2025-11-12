# QUE FAIRE APRÈS

frontend est maintenant configuré avec **AFGH (Proxy Re-Encryption)**.


## 🚧 Ce qu'il reste à faire

### 1. Finir l'adaptation Frontend 



#### A. Adapter FileShareDialog.tsx

Le fichier `src/components/files/FileShareDialog.tsx` doit :

1. Utiliser `afghService.generateReEncryptionKey()` au lieu de `cryptoService.encryptKeyForSharing()`
2. Envoyer la clé de re-chiffrement au serveur

**Code à ajouter** :

```typescript
// Générer la clé de re-chiffrement
const { keyPair, masterKey } = useAuth();

// Récupérer la clé publique du destinataire
const recipientPublicKey = await apiService.getUserPublicKey(recipientEmail);

// Générer rk_{owner→recipient}
const rkResult = await afghService.generateReEncryptionKey(
  keyPair.secretKey2,
  recipientPublicKey,
  keyPair.userId,
  recipientEmail,
  "read"
);

// Envoyer au serveur
await apiService.createShare({
  fileId,
  recipientId: recipientEmail,
  reEncryptionKey: {
    key: rkResult.keyBase64,
    fromUserId: keyPair.userId,
    toUserId: recipientEmail,
  },
  ownerPublicKey: afghService.extractPublicKey(keyPair),
});
```

---

### 2. Implémenter le Backend 

#### A. Mise à jour du Schéma Base de Données

##### Table `users` (modifier)

```sql
ALTER TABLE users
ADD COLUMN public_key_1 TEXT,  -- A1 = g^a1
ADD COLUMN public_key_2 TEXT,  -- A2 = g^a2
ADD COLUMN key_derivation_salt TEXT;  -- Salt pour PBKDF2
```

##### Table `files` (modifier)

```sql
ALTER TABLE files
ADD COLUMN kem_u TEXT,          -- U = g^k
ADD COLUMN kem_v TEXT,          -- V = S · Z^(a1·a2·k)
ADD COLUMN kem_level INTEGER DEFAULT 2,  -- Niveau de chiffrement
ADD COLUMN wrapped_file_key TEXT,  -- K_file wrappé avec K_sym
ADD COLUMN wrap_key_iv TEXT;       -- IV pour le wrapping
```

##### Table `reencryption_keys` 

```sql
CREATE TABLE reencryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  from_user_id VARCHAR(255) REFERENCES users(id),
  to_user_id VARCHAR(255) REFERENCES users(id),

  -- Clé de re-chiffrement rk_{A→B} = g^(b2/a2)
  re_encryption_key TEXT NOT NULL,

  -- Clé publique du propriétaire (pour re-chiffrement)
  owner_public_key_1 TEXT NOT NULL,  -- A1
  owner_public_key_2 TEXT NOT NULL,  -- A2

  permissions VARCHAR(50) DEFAULT 'read',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  UNIQUE(file_id, from_user_id, to_user_id)
);

CREATE INDEX idx_reencryption_keys_file ON reencryption_keys(file_id);
CREATE INDEX idx_reencryption_keys_recipient ON reencryption_keys(to_user_id);
```

#### B. Endpoints API à Créer/Modifier

##### 1. POST `/api/auth/register` (modifier)

**Body** :

```json
{
  "email": "alice@example.com",
  "password": "hashed_password",
  "name": "Alice",
  "publicKey": {
    "publicKey1": "base64_A1",
    "publicKey2": "base64_A2"
  },
  "keyDerivationSalt": "base64_salt"
}
```

**Action** : Stocker `public_key_1`, `public_key_2`, `key_derivation_salt` dans la table `users`.

##### 2. POST `/api/files/upload` (modifier)

**Body** :

```json
{
  "fileId": "uuid",
  "fileName": "document.pdf",
  "fileSize": 104857600,
  "mimeType": "application/pdf",

  "kemCiphertext": {
    "U": "base64_g^k",
    "V": "base64_S·Z^(a1·a2·k)",
    "level": 2
  },
  "wrappedFileKey": "base64_K_file_wrapped",
  "wrapKeyIV": "base64_iv",

  "chunks": [
    {
      "chunkIndex": 0,
      "encryptedData": "base64_encrypted_chunk",
      "iv": "base64_iv",
      "hash": "base64_sha256_of_original",
      "originalSize": 1048576
    }
    // ... autres chunks
  ],

  "metadata": {
    "ownerId": "alice@example.com",
    "kemAlgorithm": "AFGH-BLS12-381",
    "demAlgorithm": "AES-256-GCM",
    "chunkSize": 1048576,
    "totalChunks": 100
  }
}
```

**Action** :

- Stocker `kem_u`, `kem_v`, `kem_level`, `wrapped_file_key`, `wrap_key_iv` dans `files`
- Stocker les chunks dans `file_chunks`

##### 3. POST `/api/shares/create` (nouveau)

**Body** :

```json
{
  "fileId": "uuid",
  "recipientId": "bob@example.com",
  "reEncryptionKey": {
    "key": "base64_g^(b2/a2)",
    "fromUserId": "alice@example.com",
    "toUserId": "bob@example.com"
  },
  "ownerPublicKey": {
    "publicKey1": "base64_A1",
    "publicKey2": "base64_A2"
  },
  "permissions": "read"
}
```

**Action** :

- Vérifier que le fichier appartient à `fromUserId`
- Stocker la clé de re-chiffrement dans `reencryption_keys`
- Créer une entrée dans `file_shares`

##### 4. GET `/api/files/shared/:fileId` (nouveau, le plus important!)

**Logique Backend** :

```javascript
async function getSharedFile(req, res) {
  const { fileId } = req.params;
  const recipientId = req.user.id; // Bob

  // 1. Vérifier permissions
  const reKey = await db.query(
    `
    SELECT * FROM reencryption_keys
    WHERE file_id = $1 AND to_user_id = $2
  `,
    [fileId, recipientId]
  );

  if (!reKey) {
    return res.status(403).json({ error: "Access denied" });
  }

  // 2. Récupérer le fichier
  const file = await db.query(
    `
    SELECT * FROM files WHERE id = $1
  `,
    [fileId]
  );

  // 3. Récupérer les chunks
  const chunks = await db.query(
    `
    SELECT * FROM file_chunks
    WHERE file_id = $1
    ORDER BY chunk_index
  `,
    [fileId]
  );

  // 4. ⚡ APPELER LE HSM POUR RE-CHIFFRER ⚡
  const reEncryptedKEM = await hsmService.reEncrypt({
    kemCiphertext: {
      U: file.kem_u,
      V: file.kem_v,
      level: 2,
    },
    reEncryptionKey: {
      key: reKey.re_encryption_key,
    },
    ownerPublicKey: {
      publicKey1: reKey.owner_public_key_1,
      publicKey2: reKey.owner_public_key_2,
    },
  });

  // 5. Retourner l'enveloppe re-chiffrée
  res.json({
    fileId: file.id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.mime_type,

    // KEM re-chiffré (niveau 1 pour Bob)
    kemCiphertext: reEncryptedKEM,
    wrappedFileKey: file.wrapped_file_key,
    wrapKeyIV: file.wrap_key_iv,

    // Chunks inchangés
    chunks: chunks.map((c) => ({
      chunkIndex: c.chunk_index,
      encryptedData: c.encrypted_data,
      iv: c.iv,
      hash: c.hash,
      originalSize: c.original_size,
    })),

    shareId: reKey.id,
    recipientId: recipientId,
    permissions: reKey.permissions,
  });
}
```

---

### 3. Service HSM de Re-chiffrement (CRITIQUE!)

Créer un fichier `backend/src/services/hsmService.ts` :

```typescript
import { afghService } from "../../../secure-storage-app/src/services/afghService";
import type {
  Level2Ciphertext,
  Level1Ciphertext,
  ReEncryptionKey,
  AFGHPublicKey,
} from "../../../secure-storage-app/src/types/afgh";

class HSMService {
  /**
   * Re-chiffre un chiffré niveau 2 (Alice) en niveau 1 (Bob)
   *
   * ULTRA-RAPIDE: ~10-20ms indépendant de la taille du fichier !
   */
  async reEncrypt(request: {
    kemCiphertext: {
      U: string; // Base64
      V: string; // Base64
      level: number;
    };
    reEncryptionKey: {
      key: string; // Base64 de g^(b2/a2)
    };
    ownerPublicKey: {
      publicKey1: string; // Base64 de A1
      publicKey2: string; // Base64 de A2
    };
  }): Promise<Level1Ciphertext> {
    console.log("[HSM] Re-encrypting file...");
    const startTime = Date.now();

    // Convertir depuis Base64
    const kemCiphertext: Level2Ciphertext = {
      U: base64ToArray(request.kemCiphertext.U),
      V: base64ToArray(request.kemCiphertext.V),
      level: 2,
    };

    const reEncryptionKey: ReEncryptionKey = {
      key: base64ToArray(request.reEncryptionKey.key),
      fromUserId: "",
      toUserId: "",
      createdAt: "",
      permissions: "read",
    };

    const ownerPublicKey: AFGHPublicKey = {
      publicKey1: base64ToArray(request.ownerPublicKey.publicKey1),
      publicKey2: base64ToArray(request.ownerPublicKey.publicKey2),
      userId: "",
    };

    // ⚡ Effectuer le re-chiffrement (RAPIDE!)
    const reEncryptedKEM = await afghService.reEncrypt(
      kemCiphertext,
      reEncryptionKey,
      ownerPublicKey
    );

    const duration = Date.now() - startTime;
    console.log(`[HSM] ✅ Re-encryption completed in ${duration}ms`);

    // Retourner en Base64
    return {
      C1_prime: arrayToBase64(reEncryptedKEM.C1_prime),
      C2_prime: arrayToBase64(reEncryptedKEM.C2_prime),
      U: arrayToBase64(reEncryptedKEM.U),
      A1: arrayToBase64(reEncryptedKEM.A1),
      A2: arrayToBase64(reEncryptedKEM.A2),
      level: 1,
    };
  }
}

// Utilitaires
function base64ToArray(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function arrayToBase64(array: Uint8Array): string {
  return Buffer.from(array).toString("base64");
}

export const hsmService = new HSMService();
```

---

### 4. Tests Backend (1 semaine)

#### A. Tests API

- Test inscription avec clés AFGH
- Test upload de fichier
- Test création de partage
- Test accès fichier partagé
- Test re-chiffrement HSM

#### B. Tests d'Intégration E2E

- Alice upload → Bob accède (Alice hors ligne)
- Partage avec plusieurs utilisateurs
- Révocation de partage
- Gestion des permissions

---

##  Checklist Complète

### Frontend

- [x] AuthContext adapté à AFGH
- [x] FileUpload adapté à AFGH
- [ ] FileList adapté à AFGH
- [ ] FileShare adapté à AFGH
- [ ] Tests E2E frontend

### Backend

- [ ] Modifier table `users` (colonnes AFGH)
- [ ] Modifier table `files` (colonnes KEM)
- [ ] Créer table `reencryption_keys`
- [ ] Endpoint POST `/api/auth/register` (modifier)
- [ ] Endpoint POST `/api/files/upload` (modifier)
- [ ] Endpoint POST `/api/shares/create` (nouveau)
- [ ] Endpoint GET `/api/files/shared/:id` (nouveau, critique!)
- [ ] Service HSM de re-chiffrement
- [ ] Tests API
- [ ] Tests E2E

### Déploiement

- [ ] Environnement de dev
- [ ] Environnement de staging
- [ ] Tests de performance (re-chiffrement ~10-20ms?)
- [ ] Tests de sécurité
- [ ] Documentation API
- [ ] Production

---

## Estimation de Temps

| Tâche              |     | Priorité     |
| ------------------ |     | -----------  |
| **Finir Frontend** |     | 🔴 URGENT    |
| **Schéma DB**      |     | 🔴 URGENT    |
| **Endpoints API**  |     | 🟠 IMPORTANT |
| **Service HSM**    |     | 🔴 URGENT    |
| **Tests**          |     | 🟢 NORMAL    |
| **Déploiement**    |     | 🟢 NORMAL    |

---




###  Schéma DB + Service HSM

1. Créer les migrations SQL 
2. Implémenter le service HSM 
3. Tester le re-chiffrement isolément 

###  Endpoints API

1. Modifier endpoint `/api/auth/register` 
2. Modifier endpoint `/api/files/upload` 
3. Créer endpoint `/api/shares/create` 
4. Créer endpoint `/api/files/shared/:id` 

### Tests et Déploiement

1. Tests unitaires backend 
2. Tests E2E 
3. Déploiement staging 

---

##  Ressources

### Documentation

- **ARCHITECTURE_AFGH_.md** - Architecture complète


### Code

- **src/services/afghService.ts** - Service crypto AFGH
- **src/services/afghFileService.ts** - Service fichiers KEM-DEM
- **src/services/afghStorageService.ts** - Stockage IndexedDB



---

## ✅ Résumé


✅ **Implémentation AFGH complète** (~1500 lignes, 3 fichiers)
✅ **Frontend adapté** (AuthContext, FileUpload)
✅ **Documentation complète** 



⚠️ **1 composants frontend** à adapter ( FileShare)
⚠️ **Backend complet** à implémenter
⚠️ **Service HSM** de re-chiffrement


