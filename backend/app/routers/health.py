from fastapi import APIRouter
from app.models.schemas import HealthResponse, CacheStats
from app.services.pinecone_client import PineconeClient
from app.services.claude_client import ClaudeClient
from app.db.database import engine
from sqlalchemy import text
from app.services.cache import (
    all_models_cache, model_profile_cache, rag_query_cache,
    compare_cache, market_cache, tco_cache, recommend_cache,
)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check():
    pinecone_status = "disconnected"
    claude_status = "disconnected"
    db_status = "disconnected"

    try:
        PineconeClient().ping()
        pinecone_status = "connected"
    except Exception:
        pass

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass

    # Skip live API ping to avoid spending tokens on health checks
    claude_status = "configured"

    return HealthResponse(
        status="ok",
        pinecone=pinecone_status,
        claude=claude_status,
        database=db_status,
        cache={
            "all_models": CacheStats(**all_models_cache.stats),
            "model_profile": CacheStats(**model_profile_cache.stats),
            "rag_query": CacheStats(**rag_query_cache.stats),
            "compare": CacheStats(**compare_cache.stats),
            "market": CacheStats(**market_cache.stats),
            "tco": CacheStats(**tco_cache.stats),
            "recommend": CacheStats(**recommend_cache.stats),
        },
    )
