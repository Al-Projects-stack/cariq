import re
import uuid
from typing import Optional
from app.services.embeddings import EmbeddingsService
from app.services.pinecone_client import PineconeClient
from app.services.claude_client import ClaudeClient
from app.models.schemas import (
    QueryResponse,
    PriceIntelligence,
    PriceRange,
    KnownFault,
)


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

    async def query(self, question: str, session_id: Optional[str] = None) -> QueryResponse:
        if session_id is None:
            session_id = str(uuid.uuid4())

        # Step 1: Embed the user query
        query_embedding = await self.embeddings.embed(question)

        # Step 2: Retrieve top 5 relevant chunks from Pinecone
        results = await self.pinecone.search(
            vector=query_embedding,
            top_k=5,
        )

        # Step 3: Build context from retrieved chunks
        context = self._build_context(results)

        # Step 4: Call Claude with context + query
        answer = await self.claude.generate(question=question, context=context)

        # Step 5: Parse structured response
        return self._parse_response(answer, results, session_id, question)

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
