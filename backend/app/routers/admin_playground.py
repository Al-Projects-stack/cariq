import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AdminUser
from app.models.schemas import ChatMessage
from app.routers.admin_auth import require_admin_user, require_csrf
from app.services.claude_client import sanitise_for_prompt

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["admin-playground"])


class PlaygroundRequest(BaseModel):
    model_config = {"extra": "forbid"}

    question: str = Field(min_length=3, max_length=500)
    history: list[ChatMessage] | None = Field(default=None, max_length=6)


@router.post("/rag/test")
@limiter.limit("30/minute")
async def rag_test(
    request: Request,
    body: PlaygroundRequest,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Dry-run a question through the full RAG pipeline.

    Same rewrite/embed/retrieve/generate path as production, but bypasses
    the answer cache and never writes to QueryLog, so test traffic cannot
    pollute failure stats or evict real cached answers. Still spends real
    Claude tokens (logged under feature="playground" by the client).
    """
    try:
        sanitise_for_prompt(body.question)
        history = [m.model_dump() for m in body.history] if body.history else None
        if history:
            for msg in history:
                sanitise_for_prompt(str(msg.get("content", "")))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from app.services.rag import RAGService

    try:
        return await RAGService().test_query(body.question.strip(), history=history)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Playground test failed: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Test run failed. Please try again.")
