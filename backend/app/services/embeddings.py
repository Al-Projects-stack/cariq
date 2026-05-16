from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


class EmbeddingsService:
    def __init__(self):
        # Pre-load so first query isn't slow
        _get_model()

    async def embed(self, text: str) -> list[float]:
        model = _get_model()
        return model.encode(text, normalize_embeddings=True).tolist()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = _get_model()
        return model.encode(texts, normalize_embeddings=True).tolist()
