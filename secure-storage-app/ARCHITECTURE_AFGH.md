# Architecture AFGH - Enregistrement et Upload

Ce document explique en détail le fonctionnement du système de chiffrement AFGH (Ateniese-Fu-Green-Hohenberger) utilisé dans cette application.

---

## 🔐 1. REGISTRATION (Enregistrement)

Lors de la création d'un compte, voici le processus complet :

### Étape 1 : Saisie des informations

```
Utilisateur entre :
- Email
- Nom
- Mot de passe
```

### Étape 2 : Génération des clés AFGH

```
1. Génération de 2 nombres secrets aléatoires : a1 et a2
   - a1, a2 ∈ Zp* (scalaires sur la courbe BLS12-381)
   - Taille : 32 bytes chacun
   ↓
2. Calcul des clés publiques :
   - A1 = g1^a1  (point sur G1, 48 bytes compressé)
   - A2 = g2^a2  (point sur G2, 96 bytes compressé)
   ↓
3. Stockage sécurisé :
   - Clés secrètes (a1, a2) → IndexedDB (chiffrées avec le mot de passe)
   - Clés publiques (A1, A2) → Serveur (peuvent être publiques)
```

### Pourquoi 2 clés ?

C'est le principe fondamental d'AFGH : on a besoin de 2 composantes pour permettre le re-chiffrement (proxy re-encryption).

- **A1** : Utilisé pour le chiffrement de niveau 1
- **A2** : Utilisé pour le chiffrement de niveau 2 (plus fort, utilisé pour les fichiers)

### Propriétés de sécurité

- **Problème du logarithme discret** : Impossible de récupérer a1, a2 depuis A1, A2
- **Courbe BLS12-381** : Courbe elliptique de niveau 128 bits de sécurité
- **Stockage sécurisé** : Les clés secrètes sont chiffrées avec le mot de passe avant d'être stockées

---

## 📤 2. UPLOAD (Téléversement de fichier)

L'upload utilise un **chiffrement hybride KEM-DEM** pour combiner la sécurité d'AFGH avec la performance d'AES.

### Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Génération du secret S (élément G2)              │
└─────────────────────────────────────────────────────────────┘
  1. Générer S aléatoire sur la courbe G2 (96 bytes)
     S = générateur_G2 × scalaire_aléatoire


┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: KEM - Encapsuler S avec AFGH                     │
└─────────────────────────────────────────────────────────────┘
  2. Chiffrer S avec AFGH niveau 2 :

     a) Récupérer les clés publiques A1 (G1) et A2 (G2)

     b) Générer k aléatoire (32 bytes)

     c) Calculer U = g1^k  (point G1)

     d) Calculer e(A1, A2)^k  (élément Fp12)
        - e() est le "pairing" : G1 × G2 → Fp12
        - C'est la magie mathématique d'AFGH !
        - Fp12 = 576 bytes

     e) Calculer V = S · e(A1, A2)^k  (Fp12)
        - S est converti en Fp12 via pairing
        - Multiplication dans le groupe Fp12

     Résultat: Ciphertext = (U, V)
     - U : 48 bytes (point G1)
     - V : 576 bytes (élément Fp12)

  3. Dériver une clé symétrique K_sym depuis S :
     K_sym = PBKDF2(S, salt, 100000 iterations)
     - Entrée : S (96 bytes) + salt (16 bytes)
     - Sortie : K_sym (32 bytes pour AES-256)

  4. "Wrapper" la clé de fichier avec K_sym :
     wrappedFileKey = AES-GCM(K_file, K_sym, IV)
     - K_file : 32 bytes (clé AES-256)
     - IV : 12 bytes
     - Résultat : wrappedFileKey (base64)


┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: DEM - Chiffrer le fichier avec AES-256-GCM       │
└─────────────────────────────────────────────────────────────┘
  5. Générer une clé de fichier K_file (AES-256)
     - 32 bytes aléatoires

  6. Découper le fichier en chunks de 1MB
     - Permet le chiffrement/déchiffrement progressif
     - Optimise l'utilisation de la mémoire

  7. Pour chaque chunk :
     chunk_chiffré = AES-256-GCM(chunk_data, K_file, IV_unique)
     - IV unique pour chaque chunk (12 bytes)
     - Tag d'authentification (16 bytes)
     - Résultat stocké en base64

  Pourquoi AES ?
  - Très rapide (accéléré matériellement)
  - Sécurité prouvée (NIST)
  - Authentification intégrée (GCM mode)


┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: Construire l'enveloppe finale                    │
└─────────────────────────────────────────────────────────────┘
  8. Créer l'enveloppe AFGHFileEnvelope :

     {
       fileId: "uuid-unique",
       fileName: "mon-fichier.pdf",
       fileSize: 10485760,
       mimeType: "application/pdf",

       kemCiphertext: {           ← AFGH niveau 2
         U: Uint8Array(48),       ← Point G1
         V: Uint8Array(576),      ← Élément Fp12
         level: 2
       },

       wrappedFileKey: "base64",  ← Clé de fichier protégée
       wrapKeyIV: "base64",       ← IV pour le wrapping

       chunks: [                  ← Données chiffrées AES
         {
           index: 0,
           encryptedData: "base64",
           iv: "base64"
         },
         ...
       ],

       metadata: {
         ownerId: "user-id",
         uploadedAt: "2025-11-12T...",
         chunkSize: 1048576,
         totalChunks: 10,
         kemAlgorithm: "AFGH-BLS12-381",
         demAlgorithm: "AES-256-GCM"
       }
     }

  9. Envoyer au serveur (ou localStorage en mode mock)
```

---

## 🔑 Pourquoi cette architecture hybride ?

### Problème : AFGH seul

**AFGH seul serait trop lent** :
- Chiffrer un fichier de 10MB directement avec AFGH prendrait plusieurs minutes
- Les opérations sur courbes elliptiques sont coûteuses en calcul
- Le pairing e(G1, G2) → Fp12 est l'opération la plus lente

### Problème : AES seul

**AES seul ne permet pas le re-chiffrement** :
- Impossible de partager un fichier sans révéler ta clé secrète
- Pas de contrôle granulaire des accès
- Nécessite de déchiffrer puis re-chiffrer avec une autre clé (dangereux)

### Solution hybride KEM-DEM

```
KEM (Key Encapsulation Mechanism)
  ↓
AFGH protège seulement un petit secret S (96 bytes)
  - Rapide car peu de données
  - Permet le re-chiffrement pour le partage
  - Sécurité basée sur le pairing

DEM (Data Encapsulation Mechanism)
  ↓
AES chiffre les données volumineuses
  - Très rapide (hardware-accelerated)
  - Authentification intégrée (GCM)
  - Sécurité prouvée

Liaison KEM → DEM
  ↓
Le secret S permet de dériver K_sym
  ↓
K_sym protège K_file
  ↓
K_file chiffre les chunks
```

**Avantages combinés :**
- ✅ Performance : AES pour les gros fichiers
- ✅ Flexibilité : AFGH pour le re-chiffrement
- ✅ Sécurité : Les deux algorithmes sont prouvés sûrs
- ✅ Partage : On re-chiffre seulement (U, V), pas tout le fichier !

---

## 📊 Schéma visuel du flux

```
TON FICHIER (10 MB)
        ↓
  [Découpage en chunks de 1MB]
        ↓
   AES-256-GCM ←──────── K_file (clé aléatoire 32 bytes)
        ↓                    ↑
  Chunks chiffrés        AES-GCM wrap
   (stockés)                  ↑
                           K_sym (32 bytes) ←─── PBKDF2(S, salt, 100k iter)
                                                        ↑
                                                  Secret S (G2, 96 bytes)
                                                        ↓
                                                 AFGH Level 2 Encrypt
                                                        ↓
                                              ┌─────────────────────┐
                                              │  U = g1^k (48 B)    │
                                              │  V = S·e(A1,A2)^k   │
                                              │      (576 B)        │
                                              └─────────────────────┘
                                                        ↓
                                                  Stocké sur serveur
                                                 (indexedDB ou backend)
```

---

## 🔐 Analyse de sécurité

### Ce qui est stocké sur le serveur

| Donnée | Taille | Protection | Peut être lu par le serveur ? |
|--------|--------|------------|-------------------------------|
| `kemCiphertext.U` | 48 bytes | Point G1 public | ❌ Non, besoin de a1 et a2 |
| `kemCiphertext.V` | 576 bytes | Fp12 chiffré | ❌ Non, besoin de déchiffrer U |
| `wrappedFileKey` | ~64 bytes | Chiffré par K_sym | ❌ Non, besoin de S |
| `chunks[].encryptedData` | Variable | AES-256-GCM | ❌ Non, besoin de K_file |
| `metadata` | Variable | Texte clair | ✅ Oui (nom, taille, date) |

### Ce qui reste sur ton appareil

| Donnée | Stockage | Protection | Peut être extrait ? |
|--------|----------|------------|---------------------|
| `a1, a2` | IndexedDB | Chiffré par mot de passe | ❌ Non si mot de passe fort |
| Mot de passe | Nulle part | Jamais stocké | ✅ N/A |
| `A1, A2` | Serveur + local | Public | ✅ Oui (mais inutile seules) |

### Scénarios d'attaque

#### ✅ Serveur compromis
```
Attaquant obtient :
- kemCiphertext (U, V)
- wrappedFileKey
- chunks chiffrés
- metadata

Attaquant NE PEUT PAS :
❌ Récupérer S depuis (U, V) sans a1, a2
❌ Récupérer K_file depuis wrappedFileKey sans K_sym
❌ Récupérer K_sym sans S
❌ Lire les chunks sans K_file

Résultat : DONNÉES PROTÉGÉES ✅
```

#### ✅ Base de données volée
```
Attaquant obtient :
- Clés secrètes chiffrées (a1_enc, a2_enc)
- Clés publiques (A1, A2)

Attaquant NE PEUT PAS :
❌ Déchiffrer a1, a2 sans le mot de passe
❌ Récupérer a1, a2 depuis A1, A2 (log discret)

Résultat : CLÉS PROTÉGÉES ✅
```

#### ❌ Mot de passe faible
```
Attaquant peut :
✅ Brute-force le mot de passe
✅ Déchiffrer a1, a2
✅ Déchiffrer tous les fichiers

Résultat : DONNÉES COMPROMISES ❌

SOLUTION : Utiliser un mot de passe FORT !
- 12+ caractères
- Majuscules, minuscules, chiffres, symboles
- Pas de mots du dictionnaire
```

---

## 🛡️ Propriétés cryptographiques d'AFGH

### Unidirectionnel (Unidirectional)
```
Alice peut partager avec Bob
  ↓
Bob NE PEUT PAS partager en retour sans permission d'Alice
```

### Non-transitif (Non-transitive)
```
Alice partage avec Bob
Bob partage avec Charlie (avec permission d'Alice)
  ↓
Le proxy NE PEUT PAS créer une clé Alice→Charlie directement
```

### Résistant à la collusion (Collusion-safe)
```
Proxy + Bob ensemble NE PEUVENT PAS :
❌ Récupérer la clé privée d'Alice (a1, a2)
❌ Déchiffrer d'autres fichiers d'Alice
❌ Partager en tant qu'Alice
```

### CCA-sécurisé (Chosen-Ciphertext Attack)
```
Même si l'attaquant peut :
- Choisir des textes à chiffrer
- Obtenir des textes chiffrés
- Modifier des textes chiffrés

Il NE PEUT PAS :
❌ Récupérer la clé secrète
❌ Déchiffrer un autre message
❌ Créer un chiffré valide sans la clé publique
```

---

## 📐 Détails mathématiques

### Courbe BLS12-381

```
Équation : y² = x³ + 4

Groupes :
- G1 : Points sur la courbe de base (Fq)
  - Ordre : r (scalaire 255 bits)
  - Taille : 48 bytes (compressé), 96 bytes (non compressé)

- G2 : Points sur la twist de la courbe (Fq²)
  - Ordre : r (même que G1)
  - Taille : 96 bytes (compressé), 192 bytes (non compressé)

- GT : Groupe cible du pairing (Fq¹²)
  - Ordre : r
  - Taille : 576 bytes

Pairing : e : G1 × G2 → GT
- Propriété bilinéaire : e(g₁ᵃ, g₂ᵇ) = e(g₁, g₂)ᵃᵇ
```

### Chiffrement AFGH Niveau 2

```
Setup:
  - Générateurs : g₁ ∈ G1, g₂ ∈ G2
  - Clé secrète : (a₁, a₂) ∈ Zr²
  - Clé publique : (A₁, A₂) = (g₁ᵃ¹, g₂ᵃ²)

Chiffrement de m ∈ G2:
  1. Choisir k ∈ Zr aléatoire
  2. U = g₁ᵏ
  3. V = m · e(A₁, A₂)ᵏ

  Ciphertext : (U, V)

Déchiffrement:
  1. Calculer e(U, A₂) = e(g₁ᵏ, g₂ᵃ²) = e(g₁, g₂)ᵏᵃ²
  2. Calculer e(A₁, g₂)ᵏ = e(g₁ᵃ¹, g₂)ᵏ = e(g₁, g₂)ᵏᵃ¹
  3. Calculer e(A₁, g₂)ᵏ · e(U, A₂) = e(g₁, g₂)ᵏᵃ¹ · e(g₁, g₂)ᵏᵃ²
                                     = e(g₁, g₂)ᵏ⁽ᵃ¹⁺ᵃ²⁾
                                     = e(A₁, A₂)ᵏ
  4. m = V / e(A₁, A₂)ᵏ
```

### Re-chiffrement (Proxy Re-Encryption)

```
Partage de Alice vers Bob:

1. Alice génère la clé de re-chiffrement :
   rk_{A→B} = b₂ / a₂  (dans Zr)

   où b₂ est la clé secrète de Bob

2. Le proxy transforme (U, V) :
   U' = U
   V' = V · e(U, g₂)^(rk_{A→B})

3. Bob déchiffre avec sa clé (b₁, b₂) :
   m = V' / e(U', B₂)^(1/b₂) · e(B₁, g₂)^(-1)

Propriété clé :
- Le proxy NE VOIT PAS a₂ ni b₂
- Le proxy NE PEUT PAS déchiffrer
- Bob NE PEUT PAS récupérer a₂
```

---

## 🔧 Implémentation technique

### Fichiers clés

```
src/services/
├── afghService.ts          ← Implémentation AFGH core
│   ├── generateKeyPair()   : Génération (a₁, a₂) → (A₁, A₂)
│   ├── encryptLevel2()     : (m, A) → (U, V)
│   ├── decryptLevel2()     : (U, V, a) → m
│   └── generateReKey()     : (a₂, b₂) → rk
│
├── afghFileService.ts      ← Chiffrement hybride KEM-DEM
│   ├── encryptFileOwner()  : File → AFGHFileEnvelope
│   ├── decryptFileOwner()  : AFGHFileEnvelope → File
│   └── encryptFileChunks() : File → EncryptedChunk[]
│
└── keyStorageService.ts    ← Stockage sécurisé IndexedDB
    ├── saveKeyPair()       : Chiffre et stocke (a₁, a₂)
    ├── loadKeyPair()       : Déchiffre et charge (a₁, a₂)
    └── deriveKey()         : PBKDF2(password, salt)
```

### Bibliothèques utilisées

| Bibliothèque | Usage | Version |
|--------------|-------|---------|
| `@noble/curves` | Courbes elliptiques BLS12-381 | ^2.x |
| `@noble/hashes` | SHA-256, PBKDF2 | ^1.x |
| Web Crypto API | AES-GCM, AES-KW | Native |

---

## 📚 Références

1. **AFGH Scheme** : Ateniese, G., Fu, K., Green, M., & Hohenberger, S. (2006). "Improved proxy re-encryption schemes with applications to secure distributed storage"

2. **BLS12-381** : https://hackmd.io/@benjaminion/bls12-381

3. **Web Crypto API** : https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

4. **@noble/curves** : https://github.com/paulmillr/noble-curves

---

## 💡 Notes de sécurité importantes

### ✅ Bonnes pratiques

1. **Mot de passe fort** (12+ caractères, mixte)
2. **HTTPS obligatoire** en production
3. **Navigateur à jour** (Chrome 60+, Firefox 57+)
4. **Pas de partage du mot de passe**
5. **Backup sécurisé** des clés secrètes

### ⚠️ Limitations actuelles

1. **Mode mock** : Données en localStorage (développement seulement)
2. **Pas de 2FA** : Authentification simple par mot de passe
3. **Pas de rotation des clés** : Clés générées une seule fois
4. **Pas de révocation** : Impossible de révoquer un partage

### 🚀 Améliorations futures

1. Backend réel avec base de données sécurisée
2. Authentification multi-facteurs (2FA)
3. Rotation automatique des clés
4. Révocation de partages
5. Audit trail des accès
6. Compression des fichiers avant chiffrement

---

**Document généré le : 2025-11-12**
**Version de l'application : 1.0.0**
**Architecture : AFGH Proxy Re-Encryption + AES-256-GCM**
