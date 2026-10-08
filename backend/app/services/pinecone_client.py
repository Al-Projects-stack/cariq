from pinecone import Pinecone
from app.config import settings


class PineconeClient:
    def __init__(self):
        pc = Pinecone(api_key=settings.pinecone_api_key)
        self.index = pc.Index(settings.pinecone_index)

    async def search(
        self,
        vector: list[float],
        top_k: int = 5,
        filter: dict | None = None,
    ) -> list[dict]:
        query_kwargs: dict = {
            "vector": vector,
            "top_k": top_k,
            "include_metadata": True,
        }
        if filter:
            query_kwargs["filter"] = filter

        result = self.index.query(**query_kwargs)
        # v6 SDK returns an object with .matches attribute
        matches = result.matches if hasattr(result, "matches") else result.get("matches", [])
        if matches and hasattr(matches[0], "score"):
            return [
                {"id": getattr(m, "id", None), "score": m.score, "metadata": m.metadata or {}}
                for m in matches
            ]
        return result.get("matches", [])

    def upsert(self, vectors: list[dict]) -> None:
        self.index.upsert(vectors=vectors)

    def delete_ids(self, ids: list[str]) -> None:
        if ids:
            self.index.delete(ids=ids)

    def fetch_ids(self, ids: list[str]) -> dict:
        """Return {id: metadata} for vectors that exist. Missing IDs are absent."""
        if not ids:
            return {}
        result = self.index.fetch(ids=ids)
        vectors = getattr(result, "vectors", None)
        if vectors is None and isinstance(result, dict):
            vectors = result.get("vectors", {})
        out = {}
        for vid, vec in (vectors or {}).items():
            meta = getattr(vec, "metadata", None)
            if meta is None and isinstance(vec, dict):
                meta = vec.get("metadata", {})
            out[vid] = meta or {}
        return out

    def total_count(self) -> int:
        stats = self.index.describe_index_stats()
        total = getattr(stats, "total_vector_count", None)
        if total is None and isinstance(stats, dict):
            total = stats.get("total_vector_count", 0)
        return int(total or 0)

    def ping(self) -> bool:
        try:
            self.index.describe_index_stats()
            return True
        except Exception:
            return False
