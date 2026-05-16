import os
import pytest

# Set dummy env vars before any app imports
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("PINECONE_API_KEY", "test-key")
os.environ.setdefault("PINECONE_INDEX", "cariq-kb")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
