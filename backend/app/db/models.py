import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer
from app.db.database import Base


def _new_uuid() -> str:
    return str(uuid.uuid4())


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CarModel(Base):
    __tablename__ = "car_models"

    id = Column(Integer, primary_key=True, index=True)
    make = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False, index=True)
    slug = Column(String(200), nullable=False, unique=True, index=True)
    json_data = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
