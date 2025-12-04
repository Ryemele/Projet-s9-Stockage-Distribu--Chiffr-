# backend/gateway/main.py
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List

import requests
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File as UploadFileType,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
from models import User, Permission, File

# -----------------------------
# CONFIG GÉNÉRALE
# -----------------------------

HSM_SERVICE_URL = os.getenv("HSM_URL", "http://localhost:8000")

UPLOAD_FOLDER = "storage"
SHARED_FOLDER = "shared"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SHARED_FOLDER, exist_ok=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key")  # à changer en prod
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h

# On indique tokenUrl=/api/auth/login (utile pour la doc OAuth2)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="Secure Storage Gateway")

# CORS pour le frontend React (localhost:5174)
origins = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# DB : dépendance FastAPI
# -----------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# JWT helpers
# -----------------------------

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    return user


# -----------------------------
# Événement de démarrage
# -----------------------------

@app.on_event("startup")
def on_startup():
    # Création des tables si elles n'existent pas
    Base.metadata.create_all(bind=engine)


# -----------------------------
# SCHEMAS Pydantic
# -----------------------------

class UserCreate(BaseModel):
    username: str  # on suppose que le frontend utilise un email ici
    password: str
    public_key: str | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    username: str
    public_key: str | None = None

    class Config:
        orm_mode = True


class FileMeta(BaseModel):
    id: str
    owner: str
    filename: str
    mime_type: str | None
    size: int | None
    created_at: datetime
    is_owner: bool

    class Config:
        orm_mode = True


class ShareRequest(BaseModel):
    receiver: str


# -----------------------------
# AUTHENTIFICATION
# -----------------------------

# Alias: /register ET /api/auth/register
@app.post("/register", status_code=status.HTTP_201_CREATED)
@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if not user_in.username or not user_in.password:
        raise HTTPException(status_code=400, detail="Username and password required")

    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=user_in.username,
        public_key=user_in.public_key,
    )
    user.set_password(user_in.password)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created successfully"}


# Alias: /login ET /api/auth/login
@app.post("/login")
@app.post("/api/auth/login")
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_in.username).first()
    if not user or not user.check_password(user_in.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.username})
    return {"token": token}


@app.post("/api/auth/logout")
def logout():
    # JWT stateless -> on ne stocke rien côté serveur
    return {"message": "Logged out"}


@app.get("/api/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# -----------------------------
# FICHIERS - HELPERS
# -----------------------------

def _ensure_permission(db: Session, file_id: str, username: str) -> File:
    """Vérifie que username a accès au fichier et renvoie l'objet File."""
    perm = (
        db.query(Permission)
        .filter(Permission.file_id == file_id, Permission.username == username)
        .first()
    )
    if not perm:
        raise HTTPException(status_code=403, detail="Access denied")

    file_obj = db.query(File).filter(File.id == file_id).first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    return file_obj


def _compute_file_path(file_id: str, username: str) -> str:
    """Renvoie le chemin physique (shared ou storage)."""
    shared_path = os.path.join(SHARED_FOLDER, f"{file_id}_{username}.enc")
    if os.path.exists(shared_path):
        return shared_path

    upload_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")
    if os.path.exists(upload_path):
        return upload_path

    # On ne lève pas ici, on laisse le code appelant gérer
    return upload_path


# -----------------------------
# UPLOAD
# -----------------------------

# Alias: /upload ET /api/files/upload
@app.post("/upload")
@app.post("/api/files/upload", response_model=FileMeta)
async def upload_file(
    file: UploadFileType = UploadFile(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Générer un ID de fichier
    file_id = str(uuid.uuid4())

    # Sauvegarder le fichier (chiffré côté frontend normalement)
    content = await file.read()
    file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")
    with open(file_path, "wb") as out:
        out.write(content)

    size = len(content) if content is not None else None

    # Créer l'entrée File en base
    file_obj = File(
        id=file_id,
        owner=current_user.username,
        filename=file.filename or "encrypted_file",
        mime_type=file.content_type,
        size=size,
        storage_path=file_path,
    )
    db.add(file_obj)

    # Ajouter la permission pour l'owner
    perm = Permission(file_id=file_id, username=current_user.username)
    db.add(perm)

    db.commit()
    db.refresh(file_obj)

    # Appel au service HSM externe pour synchroniser les métadonnées (optionnel)
    try:
        payload = {
            "file_id": file_id,
            "capsule_b64": "simulated_capsule_base64",
            "ciphertext_b64": "simulated_ciphertext_base64",
        }
        headers = {"Authorization": f"Bearer {current_user.username}"}
        resp = requests.post(
            f"{HSM_SERVICE_URL}/files/upload",
            json=payload,
            headers=headers,
            timeout=5,
        )
        if resp.status_code != 201:
            print(f"HSM Warning: {resp.text}")
    except requests.exceptions.RequestException as e:
        print(f"HSM Connection Error: {str(e)}")

    return FileMeta(
        id=file_obj.id,
        owner=file_obj.owner,
        filename=file_obj.filename,
        mime_type=file_obj.mime_type,
        size=file_obj.size,
        created_at=file_obj.created_at,
        is_owner=True,
    )


# -----------------------------
# LISTE DES FICHIERS
# -----------------------------

@app.get("/api/files", response_model=List[FileMeta])
def list_files(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    perms = db.query(Permission).filter(Permission.username == current_user.username).all()
    file_ids = {p.file_id for p in perms}

    if not file_ids:
        return []

    files = db.query(File).filter(File.id.in_(file_ids)).all()

    result: List[FileMeta] = []
    for f in files:
        result.append(
            FileMeta(
                id=f.id,
                owner=f.owner,
                filename=f.filename,
                mime_type=f.mime_type,
                size=f.size,
                created_at=f.created_at,
                is_owner=(f.owner == current_user.username),
            )
        )
    return result


@app.get("/api/files/{file_id}", response_model=FileMeta)
def get_file_meta(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_obj = _ensure_permission(db, file_id, current_user.username)
    return FileMeta(
        id=file_obj.id,
        owner=file_obj.owner,
        filename=file_obj.filename,
        mime_type=file_obj.mime_type,
        size=file_obj.size,
        created_at=file_obj.created_at,
        is_owner=(file_obj.owner == current_user.username),
    )


# -----------------------------
# DOWNLOAD - binaire pour le frontend
# -----------------------------

@app.get("/api/files/{file_id}/download")
def download_file_api(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Vérifie les droits + existence du fichier en base
    _ = _ensure_permission(db, file_id, current_user.username)

    file_path = _compute_file_path(file_id, current_user.username)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # On renvoie le fichier chiffré ; le frontend le déchiffre
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=f"{file_id}.enc",
    )


# Ancienne route JSON pour debug/HSM
@app.get("/download/{file_id}")
def download_file_legacy(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = _ensure_permission(db, file_id, current_user.username)

    file_path = _compute_file_path(file_id, current_user.username)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    hsm_data: Dict[str, Any] = {}
    try:
        headers = {"Authorization": f"Bearer {current_user.username}"}
        resp = requests.get(
            f"{HSM_SERVICE_URL}/files/download_info/{file_id}",
            headers=headers,
            timeout=5,
        )

        if resp.status_code == 200:
            hsm_data = resp.json()
        else:
            hsm_data = {"error": "Key not found in HSM"}
    except requests.exceptions.RequestException:
        hsm_data = {"error": "HSM unavailable"}

    return {
        "message": "Access granted. File ready for download.",
        "file_id": file_id,
        "user": current_user.username,
        "path": file_path,
        "crypto_metadata": hsm_data,
    }


# -----------------------------
# DELETE FILE
# -----------------------------

@app.delete("/api/files/{file_id}")
def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_obj = db.query(File).filter(File.id == file_id).first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    if file_obj.owner != current_user.username:
        raise HTTPException(status_code=403, detail="Only owner can delete the file")

    # Supprimer permissions
    db.query(Permission).filter(Permission.file_id == file_id).delete()

    # Supprimer le fichier en base
    db.delete(file_obj)
    db.commit()

    # Supprimer les fichiers sur disque (storage + shared copies)
    upload_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")
    if os.path.exists(upload_path):
        os.remove(upload_path)

    # Supprimer toutes les copies partagées
    for fname in os.listdir(SHARED_FOLDER):
        if fname.startswith(file_id + "_") and fname.endswith(".enc"):
            try:
                os.remove(os.path.join(SHARED_FOLDER, fname))
            except OSError:
                pass

    return {"message": "File deleted"}


# -----------------------------
# SHARE
# -----------------------------

# Ancienne route form-data pour debug
@app.post("/share")
def share_file_legacy(
    file_id: str = Form(...),
    receiver: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _share_file_common(file_id=file_id, receiver=receiver, current_user=current_user, db=db)


# Nouvelle route attendue par le frontend
@app.post("/api/files/{file_id}/share")
def share_file_api(
    file_id: str,
    body: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _share_file_common(file_id=file_id, receiver=body.receiver, current_user=current_user, db=db)


def _share_file_common(file_id: str, receiver: str, current_user: User, db: Session):
    # Vérifier si le user actuel a le droit de partager
    perm = (
        db.query(Permission)
        .filter(Permission.file_id == file_id, Permission.username == current_user.username)
        .first()
    )
    if not perm:
        raise HTTPException(status_code=403, detail="You don't have permission to share this file")

    src_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.enc")
    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="File not found")

    dst_path = os.path.join(SHARED_FOLDER, f"{file_id}_{receiver}.enc")
    with open(src_path, "rb") as src, open(dst_path, "wb") as dst:
        dst.write(src.read())

    # Ajouter le droit d'accès pour le receiver
    perm_new = Permission(file_id=file_id, username=receiver)
    db.add(perm_new)
    db.commit()
    db.refresh(perm_new)

    return {
        "message": f"File shared with {receiver}",
        "shared_path": dst_path,
    }


@app.get("/api/files/shared", response_model=List[FileMeta])
def list_shared_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    perms = db.query(Permission).filter(Permission.username == current_user.username).all()
    file_ids = {p.file_id for p in perms}

    if not file_ids:
        return []

    files = db.query(File).filter(File.id.in_(file_ids)).all()

    result: List[FileMeta] = []
    for f in files:
        # shared = accessible mais dont je ne suis pas owner
        if f.owner != current_user.username:
            result.append(
                FileMeta(
                    id=f.id,
                    owner=f.owner,
                    filename=f.filename,
                    mime_type=f.mime_type,
                    size=f.size,
                    created_at=f.created_at,
                    is_owner=False,
                )
            )
    return result


# -----------------------------
# PUBLIC KEY
# -----------------------------

@app.get("/api/users/{email}/public-key")
def get_public_key(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == email).first()
    if not user or not user.public_key:
        raise HTTPException(status_code=404, detail="Public key not found")

    return {
        "email": user.username,
        "public_key": user.public_key,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
