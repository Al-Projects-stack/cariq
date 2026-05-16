import logging
from fastapi import APIRouter, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import QueryRequest, QueryResponse
from app.services.rag import RAGService
from app.services.claude_client import sanitise_for_prompt

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["query"])
rag_service = RAGService()


@router.post("/query", response_model=QueryResponse)
@limiter.limit("10/minute")
async def query_endpoint(request: Request, body: QueryRequest):
    try:
        sanitise_for_prompt(body.question)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = await rag_service.query(
            question=body.question,
            session_id=body.session_id,
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
