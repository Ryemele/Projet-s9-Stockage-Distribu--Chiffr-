# backend/gateway/models.py
"""
Modèles SQLAlchemy pour le Gateway FastAPI
Compatible avec le schéma PostgreSQL (users, files, chunks, shares)
"""
from datetime import datetime
import uuid as uuid_module

from sqlalchemy import Column, String, Integer, BigInteger, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from werkzeug.security import generate_password_hash, check_password_hash

from database import Base


def generate_uuid():
    return uuid_module.uuid4()


class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(Text, nullable=False)
    public_key = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    files = relationship("File", back_populates="owner", cascade="all, delete-orphan")
    shares_given = relationship("Share", back_populates="sharer", foreign_keys="Share.shared_by")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "user_id": str(self.user_id),
            "email": self.email,
            "name": self.name,
            "public_key": self.public_key,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class File(Base):
    __tablename__ = "files"

    file_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(UUID(as_uuid=True), nullable=True)  # Folder containing this file
    team_id = Column(UUID(as_uuid=True), nullable=True)  # Team this file is shared with
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    size_bytes = Column(BigInteger, nullable=False)
    total_chunks = Column(Integer, nullable=False, default=1)
    is_chunked = Column(Integer, nullable=False, default=0)  # 1 if using erasure coding
    checksum = Column(String(64), nullable=True)  # SHA256 of original file
    encryption_key_wrapped = Column(Text, nullable=True)
    iv = Column(Text, nullable=True)
    salt = Column(Text, nullable=True)
    starred = Column(Integer, nullable=False, default=0)  # 1 if starred
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    owner = relationship("User", back_populates="files")
    chunks = relationship("Chunk", back_populates="file", cascade="all, delete-orphan")
    shares = relationship("Share", back_populates="file", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "file_id": str(self.file_id),
            "id": str(self.file_id),
            "owner_id": str(self.owner_id),
            "userId": str(self.owner_id),
            "folder_id": str(self.folder_id) if self.folder_id else None,
            "folderId": str(self.folder_id) if self.folder_id else None,
            "team_id": str(self.team_id) if self.team_id else None,
            "teamId": str(self.team_id) if self.team_id else None,
            "filename": self.filename,
            "name": self.filename,
            "mime_type": self.mime_type,
            "mimeType": self.mime_type,
            "size_bytes": self.size_bytes,
            "size": self.size_bytes,
            "total_chunks": self.total_chunks,
            "is_chunked": bool(self.is_chunked),
            "isChunked": bool(self.is_chunked),
            "checksum": self.checksum,
            "starred": bool(self.starred) if self.starred else False,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "uploadedAt": self.created_at.isoformat() if self.created_at else None
        }


class Chunk(Base):
    __tablename__ = "chunks"

    chunk_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.file_id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    s3_key = Column(String(500), nullable=False)
    minio_node = Column(Integer, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    file = relationship("File", back_populates="chunks")

    def to_dict(self):
        return {
            "chunk_id": str(self.chunk_id),
            "file_id": str(self.file_id),
            "chunk_index": self.chunk_index,
            "sha256": self.sha256,
            "s3_key": self.s3_key,
            "minio_node": self.minio_node,
            "size_bytes": self.size_bytes
        }


class Share(Base):
    __tablename__ = "shares"

    share_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.file_id", ondelete="CASCADE"), nullable=False)
    shared_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    shared_with_email = Column(String(255), nullable=False)
    encrypted_key = Column(Text, nullable=True)
    permissions = Column(String(50), nullable=False, default="read")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    file = relationship("File", back_populates="shares")
    sharer = relationship("User", back_populates="shares_given", foreign_keys=[shared_by])

    def to_dict(self):
        return {
            "share_id": str(self.share_id),
            "file_id": str(self.file_id),
            "shared_by": str(self.shared_by),
            "shared_with_email": self.shared_with_email,
            "permissions": self.permissions,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Folder(Base):
    __tablename__ = "folders"

    folder_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(50), nullable=True, default="blue")
    parent_folder_id = Column(UUID(as_uuid=True), ForeignKey("folders.folder_id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    owner = relationship("User", backref="folders")
    parent = relationship("Folder", remote_side=[folder_id], backref="subfolders")

    def to_dict(self):
        return {
            "id": str(self.folder_id),
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "parentFolderId": str(self.parent_folder_id) if self.parent_folder_id else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "fileCount": 0,  # Will be calculated
            "size": 0  # Will be calculated
        }


class Team(Base):
    __tablename__ = "teams"

    team_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    settings = Column(Text, nullable=True)  # JSON string for settings

    # Relations
    creator = relationship("User", backref="teams_created")

    def to_dict(self):
        import json
        settings_dict = {}
        if self.settings:
            try:
                settings_dict = json.loads(self.settings)
            except:
                pass
        return {
            "id": str(self.team_id),
            "name": self.name,
            "description": self.description,
            "createdBy": str(self.created_by),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "settings": settings_dict,
            "memberCount": 0,  # Will be calculated
            "sharedFiles": 0  # Will be calculated
        }


class TeamMember(Base):
    __tablename__ = "team_members"

    member_id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.team_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False, default="member")  # admin, member, viewer
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    team = relationship("Team", backref="members")
    user = relationship("User", backref="team_memberships")

    def to_dict(self):
        return {
            "id": str(self.member_id),
            "teamId": str(self.team_id),
            "userId": str(self.user_id),
            "role": self.role,
            "joinedAt": self.joined_at.isoformat() if self.joined_at else None
        }
