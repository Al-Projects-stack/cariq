"""
Ingestion script: reads all JSON files from knowledge_base/cars/,
chunks them, embeds each chunk, and upserts into Pinecone.

Chunking lives in app/services/chunking.py (shared with the admin
publish flow) so both paths always produce identical chunks and IDs.

Run from the backend/ directory:
    python scripts/ingest.py
"""
import json
import sys
import asyncio
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing app modules (config reads env at import time)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.chunking import chunk_car_dict
from app.services.embeddings import EmbeddingsService
from app.services.kb_admin import slugify
from app.services.pinecone_client import PineconeClient

KB_DIR = Path(__file__).parent.parent / "knowledge_base" / "cars"
BATCH_SIZE = 10


async def ingest_all():
    embeddings_svc = EmbeddingsService()
    pinecone_client = PineconeClient()

    json_files = sorted(KB_DIR.glob("*.json"))
    if not json_files:
        print(f"No JSON files found in {KB_DIR}")
        return

    all_chunks: list[dict] = []
    for fp in json_files:
        print(f"Reading {fp.name}...")
        with open(fp, encoding="utf-8") as f:
            car = json.load(f)
        chunks = chunk_car_dict(car, slugify(car["make"], car["model"]))
        all_chunks.extend(chunks)
        print(f"  -> {len(chunks)} chunks")

    print(f"\nTotal chunks to embed: {len(all_chunks)}")

    # Embed and upsert in batches
    for i in range(0, len(all_chunks), BATCH_SIZE):
        batch = all_chunks[i : i + BATCH_SIZE]
        texts = [c["text"] for c in batch]
        print(f"Embedding batch {i // BATCH_SIZE + 1} ({len(texts)} chunks)...")
        embeddings = await embeddings_svc.embed_batch(texts)

        vectors = []
        for chunk, embedding in zip(batch, embeddings):
            metadata = {k: v for k, v in chunk.items() if k not in ("text", "id")}
            metadata["text"] = chunk["text"][:1000]  # Pinecone metadata limit
            vectors.append({
                "id": chunk["id"],
                "values": embedding,
                "metadata": metadata,
            })

        pinecone_client.upsert(vectors)
        print(f"  -> Upserted {len(vectors)} vectors to Pinecone")

    print("\nIngestion complete!")


if __name__ == "__main__":
    asyncio.run(ingest_all())
