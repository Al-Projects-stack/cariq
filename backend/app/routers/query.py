import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import FeedbackRequest, QueryRequest, QueryResponse
from app.services.rag import RAGService
from app.services.claude_client import sanitise_for_prompt
from app.services.tracking import record_vote

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["query"])
rag_service = RAGService()


@router.post("/query", response_model=QueryResponse)
@limiter.limit("10/minute")
async def query_endpoint(request: Request, body: QueryRequest):
    try:
        sanitise_for_prompt(body.question)
        for msg in body.history or []:
            sanitise_for_prompt(msg.content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        client_ip = request.client.host if request.client else None
        result = await rag_service.query(
            question=body.question,
            session_id=body.session_id,
            history=[m.model_dump() for m in body.history] if body.history else None,
            client_ip=client_ip,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"RAG query error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again.",
        )


@router.post("/feedback")
@limiter.limit("30/minute")
async def feedback_endpoint(request: Request, body: FeedbackRequest, db: Session = Depends(get_db)):
    """Thumbs up/down on an answer. Linked to the logged query id."""
    log = record_vote(db, body.query_id, body.vote)
    if not log:
        raise HTTPException(status_code=404, detail="Query not found")
    return {"ok": True}
