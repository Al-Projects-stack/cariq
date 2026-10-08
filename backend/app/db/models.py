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
    rewritten_question = Column(Text, nullable=True)
    answer = Column(Text, nullable=True)
    # Failure tracking (Step 5): retrieval debug + classification
    retrieved_chunk_ids = Column(Text, nullable=True)  # JSON list of Pinecone vector IDs
    scores = Column(Text, nullable=True)  # JSON list of similarity scores (top-5 order)
    top_score = Column(Float, nullable=True)
    refused = Column(Boolean, default=False)
    response_time_ms = Column(Integer, nullable=True)
    ip_hash = Column(String(128), nullable=True)  # salted hash, never plain IP
    vote = Column(String(10), nullable=True)  # up | down
    failure_reason = Column(String(50), nullable=True)
    group_id = Column(Integer, ForeignKey("failed_question_groups.id"), nullable=True)
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


# --- Admin dashboard ---


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="editor")  # admin | editor
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    disabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    refresh_tokens = relationship("AdminRefreshToken", back_populates="admin_user", cascade="all, delete-orphan")


class AdminRefreshToken(Base):
    __tablename__ = "admin_refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    admin_user = relationship("AdminUser", back_populates="refresh_tokens")


class KbModel(Base):
    """Live (published) content for one car model. Drafts live in model_versions."""

    __tablename__ = "kb_models"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(200), nullable=False, unique=True, index=True)
    make = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="draft")  # draft | live | deleted
    variants = Column(Text, nullable=False, default="[]")  # JSON list
    years_covered = Column(String(50), default="")
    sa_market_summary = Column(Text, default="")
    reliability_score = Column(Float, default=0.0)
    segment = Column(String(100), default="")
    fuel_type = Column(String(50), default="")
    fuel_consumption_l_per_100km = Column(Float, nullable=True)
    annual_maintenance_zar = Column(Integer, nullable=True)
    annual_insurance_zar = Column(Integer, nullable=True)
    owner_sentiment = Column(Text, default="")
    sources = Column(Text, nullable=False, default="[]")  # JSON list
    published_version_id = Column(Integer, nullable=True)  # no FK: avoids create cycle with model_versions
    published_at = Column(DateTime, nullable=True)
    chunk_ids = Column(Text, nullable=False, default="[]")  # JSON list of live Pinecone vector IDs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    faults = relationship("KbFault", back_populates="kb_model", cascade="all, delete-orphan")
    price_ranges = relationship("KbPriceRange", back_populates="kb_model", cascade="all, delete-orphan")
    checklist_items = relationship("KbChecklistItem", back_populates="kb_model", cascade="all, delete-orphan")
    versions = relationship("ModelVersion", back_populates="kb_model", cascade="all, delete-orphan")


class KbFault(Base):
    __tablename__ = "kb_faults"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("kb_models.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    severity = Column(String(20), nullable=False, default="MEDIUM")  # LOW | MEDIUM | HIGH | CRITICAL
    mileage_range = Column(String(100), default="")
    what_to_inspect = Column(Text, default="")
    repair_min_zar = Column(Integer, nullable=True)
    repair_max_zar = Column(Integer, nullable=True)
    affected_variants = Column(Text, nullable=False, default="[]")  # JSON list
    affected_years = Column(Text, nullable=True)  # JSON list, nullable: not present in legacy JSON
    source = Column(String(500), default="")
    position = Column(Integer, default=0)

    kb_model = relationship("KbModel", back_populates="faults")


class KbPriceRange(Base):
    __tablename__ = "kb_price_ranges"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("kb_models.id"), nullable=False, index=True)
    year_from = Column(Integer, nullable=False)
    year_to = Column(Integer, nullable=False)
    low_zar = Column(Integer, nullable=False)
    mid_zar = Column(Integer, nullable=False)
    high_zar = Column(Integer, nullable=False)

    kb_model = relationship("KbModel", back_populates="price_ranges")


class KbChecklistItem(Base):
    __tablename__ = "kb_checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("kb_models.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    position = Column(Integer, default=0)

    kb_model = relationship("KbModel", back_populates="checklist_items")


class ModelVersion(Base):
    """Full snapshot of a model at save time. Rollback restores one as a new draft."""

    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("kb_models.id"), nullable=False, index=True)
    kind = Column(String(20), nullable=False)  # draft | published
    snapshot = Column(Text, nullable=False)  # full model JSON, same shape as legacy car files
    created_by = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    kb_model = relationship("KbModel", back_populates="versions")


class AuditLog(Base):
    """Append-only from the application side: no update/delete code paths exist."""

    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(255), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    model_slug = Column(String(200), nullable=True, index=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(20), nullable=False)  # publish | reindex_all
    model_slug = Column(String(200), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="queued", index=True)
    # queued | embedding | upserting | done | failed
    error = Column(Text, nullable=True)
    created_by = Column(String(255), default="")
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)


class FailedQuestionGroup(Base):
    __tablename__ = "failed_question_groups"

    id = Column(Integer, primary_key=True, index=True)
    normalized = Column(Text, nullable=False, unique=True)
    sample_question = Column(Text, nullable=False)
    count = Column(Integer, default=1)
    reason = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="open", index=True)  # open | resolved
    note = Column(Text, nullable=True)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
