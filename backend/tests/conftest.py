import os
import pytest

# Set dummy env vars before any app imports
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("PINECONE_API_KEY", "test-key")
os.environ.setdefault("PINECONE_INDEX", "cariq-kb")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")


def make_test_app(*router_prefixes):
    """Minimal FastAPI app mounting (router, prefix) pairs on an isolated
    in-memory SQLite DB. Avoids importing app.main (which builds a real
    Pinecone client at module import). Returns (TestClient, SessionLocal)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi import _rate_limit_exceeded_handler
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    import app.db.database as db_mod
    from app.db.database import Base
    import app.db.models  # noqa: F401  (register tables)
    from app.db.database import get_db

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    for router, prefix in router_prefixes:
        app.include_router(router, prefix=prefix)

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), TestingSession
