import os, uuid, hashlib
from datetime import timedelta
from typing import List

import boto3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text

# ----- Vars d'env -----
S3_ENDPOINT   = os.getenv("S3_ENDPOINT", "http://minio1:9000")
S3_REGION     = os.getenv("S3_REGION", "us-east-1")
S3_BUCKET     = os.getenv("S3_BUCKET", "secure-files")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
DATABASE_URL  = os.getenv("DATABASE_URL")

if not all([S3_ACCESS_KEY, S3_SECRET_KEY, DATABASE_URL]):
    raise RuntimeError("Missing env vars: S3_ACCESS_KEY / S3_SECRET_KEY / DATABASE_URL")

# ----- Clients -----
s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
)

db = create_engine(DATABASE_URL, pool_pre_ping=True)
app = FastAPI()

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
    chunk_hashes: List[str]  # sha256 of ciphertext, position = offset

@app.post("/upload/init")
def init_upload(req: InitUploadReq):
    file_id = str(uuid.uuid4())
    with db.begin() as cx:
        cx.execute(
            text("INSERT INTO files(file_id, owner_id, filename, size_bytes) VALUES (:f, :o, :n, :s)"),
            {"f": file_id, "o": req.owner_id, "n": req.filename, "s": req.total_size},
        )
    return {"file_id": file_id}

@app.post("/upload/presign")
def presign(req: PresignReq):
    urls = []
    for offset in req.offsets:
        s3_key = f"{req.file_id}/{offset}"
        url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=int(timedelta(minutes=15).total_seconds()),
        )
        urls.append({"offset": offset, "url": url, "s3_key": s3_key})
    return {"parts": urls}

@app.post("/upload/commit")
def commit(req: CommitReq):
    with db.begin() as cx:
        for offset, h in enumerate(req.chunk_hashes):
            s3_key = f"{req.file_id}/{offset}"
            head = s3.head_object(Bucket=S3_BUCKET, Key=s3_key)
            etag = head.get("ETag", "").strip('"')
            size = head.get("ContentLength", 0)
            cx.execute(
                text(
                    "INSERT INTO chunks(file_id, offset, size_bytes, sha256, etag, s3_key) "
                    "VALUES (:f, :o, :sz, :h, :e, :k) "
                    "ON CONFLICT (file_id, offset) DO NOTHING"
                ),
                {"f": req.file_id, "o": offset, "sz": size, "h": h, "e": etag, "k": s3_key},
            )
    return {"status": "ok"}

@app.get("/download/{file_id}")
def list_download(file_id: str):
    with db.begin() as cx:
        rows = cx.execute(
            text("SELECT offset, sha256, s3_key FROM chunks WHERE file_id=:f ORDER BY offset ASC"),
            {"f": file_id},
        ).mappings().all()
    parts = []
    for r in rows:
        url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": S3_BUCKET, "Key": r["s3_key"]},
            ExpiresIn=900,
        )
        parts.append({"offset": r["offset"], "sha256": r["sha256"], "url": url})
    return {"parts": parts}
