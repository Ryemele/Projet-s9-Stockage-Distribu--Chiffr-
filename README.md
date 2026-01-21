# Secure Distributed Storage

Stockage distribue chiffre - Projet S9

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Gateway     │────▶│   PostgreSQL    │
│   (React/Vite)  │     │    (FastAPI)    │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────────┐
                   │      MinIO Cluster          │
                   │  (4 nodes - distributed)    │
                   └─────────────────────────────┘
```

## Structure du Projet

```
.
├── backend/
│   ├── gateway/              # API Gateway (FastAPI)
│   │   ├── main.py           # Endpoints REST
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── database.py       # Database config
│   │   ├── minio_service.py  # MinIO client
│   │   └── requirements.txt  # Dependencies Python
│   └── hsm/                  # Hardware Security Module (simulation)
├── frontend/                 # React + TypeScript + Vite
│   └── src/
│       ├── components/       # Composants React
│       ├── services/         # API service
│       ├── pages/            # Pages de l'app
│       └── types/            # TypeScript types
├── db/
│   └── init.sql              # Schema PostgreSQL
├── scripts/                  # Scripts utilitaires
├── docker-compose.yaml       # Infrastructure
└── .env                      # Configuration
```

## Quick Start

### 1. Lancer l'infrastructure (Docker)

```bash
docker-compose up -d
```

Cela demarre:
- **PostgreSQL** sur le port `5432`
- **MinIO Cluster** (4 noeuds) sur les ports `9000` (API) et `9001` (Console)

### 2. Lancer le Gateway (Backend)

```bash
cd backend/gateway
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Le gateway sera disponible sur `http://localhost:8080`

### 3. Lancer le Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend sera disponible sur `http://localhost:5173`

## API Endpoints

### Authentification
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Deconnexion |
| GET | `/api/auth/me` | Utilisateur courant |

### Fichiers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload fichier |
| GET | `/api/files` | Liste des fichiers |
| GET | `/api/files/{id}` | Details fichier |
| GET | `/api/files/{id}/download` | Telecharger fichier |
| DELETE | `/api/files/{id}` | Supprimer fichier |

### Partage
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/{id}/share` | Partager fichier |
| GET | `/api/files/shared` | Fichiers partages avec moi |
| GET | `/api/users/{email}/public-key` | Cle publique utilisateur |

## Configuration

### Variables d'environnement (.env)

```env
# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123456
S3_BUCKET=secure-files
S3_ACCESS_KEY=gateway-user
S3_SECRET_KEY=gateway-secret-key-123

# PostgreSQL
PG_USER=postgres
PG_PASSWORD=postgres123
PG_DB=storage
PG_PORT=5432

# Gateway
GATEWAY_PORT=8080
```

## Base de Donnees

### Schema PostgreSQL

- **users**: Utilisateurs (email, password_hash, public_key)
- **files**: Metadonnees fichiers (filename, size, chunks)
- **chunks**: Fragments stockes dans MinIO
- **shares**: Partages entre utilisateurs

## Technologies

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Axios
- **Backend**: FastAPI, SQLAlchemy, python-jose (JWT)
- **Storage**: MinIO (S3-compatible, distributed)
- **Database**: PostgreSQL 16
- **Container**: Docker, Docker Compose

## Acces Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | - |
| Gateway API | http://localhost:8080 | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123456 |
| PostgreSQL | localhost:5432 | postgres / postgres123 |
