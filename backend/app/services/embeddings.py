from fastembed import TextEmbedding

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding("BAAI/bge-small-en-v1.5")
    return _model


class EmbeddingsService:
    def __init__(self):
        _get_model()

    async def embed(self, text: str) -> list[float]:
        model = _get_model()
        return list(model.embed([text]))[0].tolist()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = _get_model()
        return [v.tolist() for v in model.embed(texts)]
