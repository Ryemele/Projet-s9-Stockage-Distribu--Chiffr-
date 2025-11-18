import os, uuid, hashlib
from datetime import timedelta
from typing import List

import boto3
from fastapi import FastAPI, File, UploadFile, Form
from pydantic import BaseModel
from sqlalchemy import create_engine, text

# ---- Endpoints ----
PUBLIC_S3_ENDPOINT = os.getenv("PUBLIC_S3_ENDPOINT", "http://localhost:9000")
S3_ENDPOINT        = os.getenv("S3_ENDPOINT", "http://minio1:9000")

# ---- Vars S3/DB ----
S3_REGION     = os.getenv("S3_REGION", "us-east-1")
S3_BUCKET     = os.getenv("S3_BUCKET", "secure-files")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
DATABASE_URL  = os.getenv("DATABASE_URL")

if not all([S3_ACCESS_KEY, S3_SECRET_KEY, DATABASE_URL]):
    raise RuntimeError("Missing env vars: S3_ACCESS_KEY / S3_SECRET_KEY / DATABASE_URL")

# ---- Clients ----
s3_internal = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
)

s3_public = boto3.client(
    "s3",
    endpoint_url=PUBLIC_S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
)

db = create_engine(DATABASE_URL, pool_pre_ping=True)
app = FastAPI()

# ---- Schemas ----
class InitUploadReq(BaseModel):
    owner_id: str
    filename: str
    total_size: int
    chunk_count: int

class PresignReq(BaseModel):
    file_id: str
    offsets: List[int]

class CommitReq(BaseModel):
    file_id: str
    chunk_hashes: List[str]

# ---- Routes ----
@app.post("/upload/init")
def init_upload(req: InitUploadReq):
    file_id = str(uuid.uuid4())
    
    with db.begin() as cx:
        # Vérifie si l'user existe, sinon le crée
        result = cx.execute(
            text("SELECT user_id FROM users WHERE user_id = :u"),
            {"u": req.owner_id}
        ).fetchone()
        
        if not result:
            fake_pubkey = b"auto-created-user"
            cx.execute(
                text("INSERT INTO users(user_id, email, public_key) VALUES (:u, :e, :k)"),
                {"u": req.owner_id, "e": f"{req.owner_id}@auto.com", "k": fake_pubkey}
            )
        
        cx.execute(
            text("INSERT INTO files(file_id, owner_id, filename, size_bytes) VALUES (:f, :o, :n, :s)"),
            {"f": file_id, "o": req.owner_id, "n": req.filename, "s": req.total_size},
        )
    return {"file_id": file_id}

@app.post("/upload/presign")
def presign(req: PresignReq):
    parts = []
    for offset in req.offsets:
        s3_key = f"{req.file_id}/{offset}"
        url = s3_public.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=int(timedelta(minutes=15).total_seconds()),
        )
        parts.append({"offset": offset, "url": url, "s3_key": s3_key})
    return {"parts": parts}

# NOUVELLE ROUTE : Upload direct (pour la démo)
@app.post("/upload/chunk")
def upload_chunk_direct(
    file_id: str = Form(...),
    offset: int = Form(...),
    chunk: UploadFile = File(...)
):
    """Upload direct d'un chunk (bypass presigned URL)"""
    s3_key = f"{file_id}/{offset}"
    
    # Upload vers MinIO
    content = chunk.file.read()
    s3_internal.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=content
    )
    
    # Calcul du hash
    sha256 = hashlib.sha256(content).hexdigest()
    
    # Récupère les métadonnées
    head = s3_internal.head_object(Bucket=S3_BUCKET, Key=s3_key)
    etag = head.get("ETag", "").strip('"')
    size = len(content)
    
    # Enregistre en DB
    with db.begin() as cx:
        cx.execute(text("""
            INSERT INTO chunks(file_id, "offset", size_bytes, sha256, etag, s3_key)
            VALUES (:f, :i, :sz, :h, :e, :k)
            ON CONFLICT (file_id, "offset") DO UPDATE SET
                size_bytes = EXCLUDED.size_bytes,
                sha256 = EXCLUDED.sha256,
                etag = EXCLUDED.etag,
                s3_key = EXCLUDED.s3_key
        """), {"f": file_id, "i": offset, "sz": size, "h": sha256, "e": etag, "k": s3_key})
    
    return {"status": "ok", "sha256": sha256, "size": size, "s3_key": s3_key}

@app.post("/upload/commit")
def commit(req: CommitReq):
    with db.begin() as cx:
        for idx, h in enumerate(req.chunk_hashes):
            s3_key = f"{req.file_id}/{idx}"
            try:
                head = s3_internal.head_object(Bucket=S3_BUCKET, Key=s3_key)
                etag = head.get("ETag", "").strip('"')
                size = head.get("ContentLength", 0)
                cx.execute(text("""
                    INSERT INTO chunks(file_id, "offset", size_bytes, sha256, etag, s3_key)
                    VALUES (:f, :i, :sz, :h, :e, :k)
                    ON CONFLICT (file_id, "offset") DO NOTHING
                """), {"f": req.file_id, "i": idx, "sz": size, "h": h, "e": etag, "k": s3_key})
            except Exception as e:
                print(f"Warning: chunk {idx} not found: {e}")
    return {"status": "ok"}

@app.get("/download/{file_id}")
def list_download(file_id: str):
    with db.begin() as cx:
        rows = cx.execute(text("""
            SELECT "offset", sha256, s3_key
            FROM chunks
            WHERE file_id=:f
            ORDER BY "offset" ASC
        """), {"f": file_id}).mappings().all()

    parts = []
    for r in rows:
        url = s3_public.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": S3_BUCKET, "Key": r["s3_key"]},
            ExpiresIn=900,
        )
        parts.append({"offset": r["offset"], "sha256": r["sha256"], "url": url})
    return {"parts": parts}

# Route de debug
@app.get("/debug/chunk/{file_id}/{chunk_index}")
def debug_chunk(file_id: str, chunk_index: int):
    """Montre où MinIO a stocké le chunk"""
    s3_key = f"{file_id}/{chunk_index}"
    
    nodes = ["minio1:9000", "minio2:9000", "minio3:9000", "minio4:9000"]
    results = {}
    
    for node in nodes:
        try:
            client = boto3.client(
                "s3",
                endpoint_url=f"http://{node}",
                aws_access_key_id=S3_ACCESS_KEY,
                aws_secret_access_key=S3_SECRET_KEY,
                region_name=S3_REGION,
            )
            head = client.head_object(Bucket=S3_BUCKET, Key=s3_key)
            results[node] = {
                "status": "OK",
                "size": head.get("ContentLength"),
                "etag": head.get("ETag", "").strip('"'),
            }
        except Exception as e:
            results[node] = {"status": "ERROR", "error": str(e)}
    
    return {"s3_key": s3_key, "nodes": results}

@app.get("/health")
def health():
    return {"status": "ok"}