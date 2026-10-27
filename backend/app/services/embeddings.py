import asyncio

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

    # Inference is CPU-bound and synchronous: run it in a worker thread so it
    # doesn't block the event loop.
    async def embed(self, text: str) -> list[float]:
        model = _get_model()
        return await asyncio.to_thread(lambda: list(model.embed([text]))[0].tolist())

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = _get_model()
        return await asyncio.to_thread(lambda: [v.tolist() for v in model.embed(texts)])
