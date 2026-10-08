import logging
import re
import time
import uuid
from typing import Optional
from app.services.embeddings import EmbeddingsService
from app.services.pinecone_client import PineconeClient
from app.services.claude_client import ClaudeClient, sanitise_for_prompt
from app.services import tracking
from app.services.cache import rag_query_cache
from app.db.database import SessionLocal
from app.db.models import QueryLog
from app.models.schemas import (
    MAX_HISTORY_MESSAGES,
    QueryResponse,
    PriceIntelligence,
    PriceRange,
    KnownFault,
)

logger = logging.getLogger(__name__)


_PRICE_KEYWORDS = re.compile(
    r"\b(price|cost|worth|fair|value|cheap|expensive|R\d{3,}|rand)\b",
    re.IGNORECASE,
)

_FAULT_KEYWORDS = re.compile(
    r"\b(fault|problem|issue|reliable|reliability|common|break|fail)\b",
    re.IGNORECASE,
)

_VERDICT_MAP = {
    "GOOD DEAL": ("GOOD DEAL", "Great price, below SA market average"),
    "FAIR": ("FAIR", "Fair price for the SA market"),
    "ABOVE MARKET": ("ABOVE MARKET", "Priced above the SA market average"),
    "OVERPRICED": ("OVERPRICED", "Significantly overpriced for SA market"),
}


class RAGService:
    def __init__(self):
        self.pinecone = PineconeClient()
        self.claude = ClaudeClient()
        self.embeddings = EmbeddingsService()

    async def query(
        self,
        question: str,
        session_id: Optional[str] = None,
        history: Optional[list[dict]] = None,
        client_ip: Optional[str] = None,
    ) -> QueryResponse:
        if session_id is None:
            session_id = str(uuid.uuid4())

        # Trim history defensively (schema already caps at last 6)
        clean_history = self._clean_history(history)

        # Step 0: Rewrite follow-ups into a standalone question so the
        # embedding retrieves on full context. No history -> no extra call.
        standalone_question = question
        if clean_history:
            try:
                rewritten = self.claude.rewrite_standalone_question(question, clean_history)
                if rewritten.strip():
                    standalone_question = rewritten.strip()
            except Exception as exc:
                logger.warning(f"Query rewrite failed, using original question: {exc}")

        # Step 0b: Cache on the rewritten question so identical follow-ups hit
        cache_key = f"q|{standalone_question.strip().lower()}"
        cached = rag_query_cache.get(cache_key)
        if cached is not None:
            return QueryResponse(**{**cached, "session_id": session_id})

        started = time.monotonic()
        try:
            # Step 1: Embed the standalone query
            query_embedding = await self.embeddings.embed(standalone_question)

            # Step 2: Retrieve top 5 relevant chunks from Pinecone
            results = await self.pinecone.search(
                vector=query_embedding,
                top_k=5,
            )

            # Step 3: Build context from retrieved chunks
            context = self._build_context(results)

            # Step 4: Call the API with context + query + history
            answer = await self.claude.generate(
                question=standalone_question, context=context, history=clean_history
            )
        except Exception:
            elapsed_ms = int((time.monotonic() - started) * 1000)
            self._log_query(
                session_id, question, standalone_question, None,
                response_time_ms=elapsed_ms, ip_hash=tracking.hash_ip(client_ip),
                failure_reason=tracking.REASON_ERROR,
            )
            raise

        # Step 5: Parse structured response
        response = self._parse_response(answer, results, session_id, standalone_question)

        # Step 6: Retrieval debug for failure tracking
        chunk_ids = [m.get("id") for m in results if m.get("id")]
        scores = [float(m.get("score") or 0) for m in results]
        top_score = max(scores) if scores else None
        refused = tracking.is_refusal(answer)
        elapsed_ms = int((time.monotonic() - started) * 1000)
        failure_reason = tracking.classify_failure(top_score, refused)

        # Step 7: Cache + log (both best-effort, never break the answer)
        cached_value = response.model_dump()
        cached_value.pop("session_id", None)
        cached_value.pop("query_id", None)
        rag_query_cache.set(cache_key, cached_value)
        response.query_id = self._log_query(
            session_id, question, standalone_question, answer,
            chunk_ids=chunk_ids, scores=scores, top_score=top_score,
            refused=refused, response_time_ms=elapsed_ms,
            ip_hash=tracking.hash_ip(client_ip), failure_reason=failure_reason,
        )

        return response

    @staticmethod
    def _clean_history(history: Optional[list[dict]]) -> list[dict]:
        if not history:
            return []
        cleaned: list[dict] = []
        for msg in history[-MAX_HISTORY_MESSAGES:]:
            if not isinstance(msg, dict):
                continue
            role = msg.get("role")
            content = msg.get("content")
            if role not in ("user", "assistant") or not isinstance(content, str):
                continue
            content = content.strip()[:1000]
            if not content:
                continue
            # History is untrusted: screen every message like the question
            sanitise_for_prompt(content)
            cleaned.append({"role": role, "content": content})
        return cleaned

    @staticmethod
    def _log_query(
        session_id: str,
        question: str,
        rewritten: str,
        answer: str | None,
        chunk_ids: list | None = None,
        scores: list | None = None,
        top_score: float | None = None,
        refused: bool = False,
        response_time_ms: int | None = None,
        ip_hash: str | None = None,
        failure_reason: str | None = None,
    ) -> int | None:
        """Write the query row plus an updated failure group. Returns the row id."""
        import json as _json

        try:
            db = SessionLocal()
            try:
                group_id = None
                if failure_reason:
                    group_id = tracking.record_failure_group(db, question, failure_reason)
                log = QueryLog(
                    session_id=session_id,
                    question=question,
                    rewritten_question=rewritten if rewritten != question else None,
                    answer=answer,
                    retrieved_chunk_ids=_json.dumps(chunk_ids) if chunk_ids else None,
                    scores=_json.dumps(scores) if scores else None,
                    top_score=top_score,
                    refused=refused,
                    response_time_ms=response_time_ms,
                    ip_hash=ip_hash,
                    failure_reason=failure_reason,
                    group_id=group_id,
                )
                db.add(log)
                db.commit()
                return log.id
            finally:
                db.close()
        except Exception as exc:
            logger.warning(f"Query log write skipped: {exc}")
        return None

    def _build_context(self, results: list[dict]) -> str:
        if not results:
            return "No relevant knowledge base entries found."

        chunks = []
        for match in results:
            metadata = match.get("metadata", {})
            score = match.get("score", 0)
            chunk_type = metadata.get("chunk_type", "general")
            make = metadata.get("make", "")
            model = metadata.get("model", "")
            text = metadata.get("text", "")
            source = metadata.get("source", "")

            header = f"[{make} {model}, {chunk_type}] (relevance: {score:.2f})"
            if source:
                header += f" | Source: {source}"
            chunks.append(f"{header}\n{text}")

        return "\n\n---\n\n".join(chunks)

    def _parse_response(
        self,
        answer: str,
        results: list[dict],
        session_id: str,
        question: str,
    ) -> QueryResponse:
        sources = self._extract_sources(answer, results)
        known_faults = self._extract_faults(results, question)
        price_intelligence = self._extract_price_intelligence(answer, results, question)

        return QueryResponse(
            answer=answer,
            price_intelligence=price_intelligence,
            known_faults=known_faults,
            sources=sources,
            session_id=session_id,
        )

    def _extract_sources(self, answer: str, results: list[dict]) -> list[str]:
        sources: set[str] = set()

        # Pull from answer text after "Sources:"
        if "Sources:" in answer:
            source_line = answer.split("Sources:")[-1].strip()
            for part in re.split(r"[,\n]", source_line):
                s = part.strip().strip("-").strip()
                if s:
                    sources.add(s)

        # Also pull from chunk metadata
        for match in results:
            metadata = match.get("metadata", {})
            source = metadata.get("source", "")
            if source:
                sources.add(source)

        return list(sources) if sources else ["CarIQ Knowledge Base"]

    def _extract_faults(self, results: list[dict], question: str) -> list[KnownFault]:
        if not _FAULT_KEYWORDS.search(question):
            return []

        faults: list[KnownFault] = []
        seen: set[str] = set()

        for match in results:
            metadata = match.get("metadata", {})
            if metadata.get("chunk_type") != "fault":
                continue

            fault_name = metadata.get("fault_name", "")
            if not fault_name or fault_name in seen:
                continue
            seen.add(fault_name)

            faults.append(
                KnownFault(
                    fault=fault_name,
                    mileage_range=metadata.get("mileage_range", "Unknown"),
                    severity=metadata.get("severity", "MEDIUM"),
                    estimated_repair_zar=metadata.get("estimated_repair_zar", "Consult a specialist"),
                )
            )

        return faults[:5]

    def _extract_price_intelligence(
        self,
        answer: str,
        results: list[dict],
        question: str,
    ) -> Optional[PriceIntelligence]:
        if not _PRICE_KEYWORDS.search(question):
            return None

        price_metadata: Optional[dict] = None
        for match in results:
            metadata = match.get("metadata", {})
            if metadata.get("chunk_type") == "price_range":
                price_metadata = metadata
                break

        if not price_metadata:
            return None

        verdict_key = "FAIR"
        upper = answer.upper()
        for key in _VERDICT_MAP:
            if key in upper:
                verdict_key = key
                break

        verdict, verdict_label = _VERDICT_MAP[verdict_key]

        return PriceIntelligence(
            model=f"{price_metadata.get('make', '')} {price_metadata.get('model', '')}".strip(),
            year=price_metadata.get("year_from"),
            price_range=PriceRange(
                low=price_metadata.get("low_zar", 0),
                mid=price_metadata.get("mid_zar", 0),
                high=price_metadata.get("high_zar", 0),
            ),
            verdict=verdict,
            verdict_label=verdict_label,
        )
