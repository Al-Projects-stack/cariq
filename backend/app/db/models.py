import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    watchlist = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    saved_searches = relationship("SavedSearch", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    make = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="watchlist")


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    label = Column(String(200), default="")
    query = Column(Text, nullable=False)
    filters = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="saved_searches")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    make = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    alert_type = Column(String(50), nullable=False)  # price_update, new_fault, general
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="alerts")


class ClaudeCallLog(Base):
    __tablename__ = "claude_call_logs"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(36), unique=True, nullable=False, index=True)
    feature = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    latency_ms = Column(Integer, default=0)
    status = Column(String(20), default="success")  # success | failed
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClaudeDeadLetter(Base):
    __tablename__ = "claude_dead_letters"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(36), unique=True, nullable=False, index=True)
    feature = Column(String(100), nullable=False, index=True)
    error_type = Column(String(100), nullable=False)
    error_message = Column(Text, nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
