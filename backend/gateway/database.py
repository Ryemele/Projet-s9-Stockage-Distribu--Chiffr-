# backend/gateway/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Utilise psycopg3 (postgresql+psycopg)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres123@localhost:5432/storage")

engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
