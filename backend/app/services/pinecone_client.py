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
        return [
            {"score": m.score, "metadata": m.metadata or {}}
            for m in matches
        ] if matches and hasattr(matches[0], "score") else result.get("matches", [])

    def upsert(self, vectors: list[dict]) -> None:
        self.index.upsert(vectors=vectors)

    def ping(self) -> bool:
        try:
            self.index.describe_index_stats()
            return True
        except Exception:
            return False
