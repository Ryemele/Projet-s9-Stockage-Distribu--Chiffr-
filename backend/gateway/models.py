# backend/gateway/models.py
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime
from werkzeug.security import generate_password_hash, check_password_hash

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # On considère que username = email pour le frontend
    username = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(200), nullable=False)

    # Clé publique AFGH envoyée par le frontend (optionnelle)
    public_key = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    def set_password(self, password: str) -> None:
        self.password = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password, password)


class File(Base):
    __tablename__ = "files"

    # On stocke le UUID en string
    id = Column(String(36), primary_key=True, index=True)
    owner = Column(String(100), nullable=False, index=True)  # username de l'owner

    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    size = Column(Integer, nullable=True)

    storage_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(100), nullable=False, index=True)
    username = Column(String(100), nullable=False, index=True)
