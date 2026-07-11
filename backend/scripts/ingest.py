"""
Ingestion script: reads all JSON files from knowledge_base/cars/,
chunks them into meaningful paragraphs, embeds each chunk via Anthropic,
and upserts into Pinecone.

Run from the backend/ directory:
    python scripts/ingest.py
"""
import json
import os
import sys
import hashlib
import asyncio
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing app modules (config reads env at import time)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.embeddings import EmbeddingsService
from app.services.pinecone_client import PineconeClient

KB_DIR = Path(__file__).parent.parent / "knowledge_base" / "cars"
BATCH_SIZE = 10


def chunk_car_file(car: dict) -> list[dict]:
    """
    Chunking strategy:
    - Each known fault = one chunk
    - Each price range year band = one chunk
    - What to inspect list = one chunk per model
    - Market summary + owner sentiment = one chunk per model
    """
    make = car["make"]
    model = car["model"]
    sources_str = ", ".join(car.get("sources", []))
    chunks: list[dict] = []

    # --- Market summary + owner sentiment chunk ---
    summary_text = (
        f"{make} {model}, SA Market Summary\n"
        f"{car.get('sa_market_summary', '')}\n\n"
        f"Reliability score: {car.get('reliability_score', 'N/A')}/10\n"
        f"Years covered: {car.get('years_covered', '')}\n"
        f"Variants: {', '.join(car.get('variants', []))}\n\n"
        f"Owner sentiment: {car.get('owner_sentiment', '')}"
    )
    chunks.append({
        "chunk_type": "summary",
        "make": make,
        "model": model,
        "text": summary_text,
        "source": sources_str,
    })

    # --- Price range chunks ---
    for pr in car.get("price_ranges", []):
        price_text = (
            f"{make} {model}, Price Range {pr['year_from']}-{pr['year_to']}\n"
            f"Low: R{pr['low_zar']:,} | Mid: R{pr['mid_zar']:,} | High: R{pr['high_zar']:,}\n"
            f"These are typical used car prices for this model in the South African market."
        )
        chunks.append({
            "chunk_type": "price_range",
            "make": make,
            "model": model,
            "year_from": pr["year_from"],
            "year_to": pr["year_to"],
            "low_zar": pr["low_zar"],
            "mid_zar": pr["mid_zar"],
            "high_zar": pr["high_zar"],
            "text": price_text,
            "source": sources_str,
        })

    # --- Known fault chunks ---
    for fault in car.get("known_faults", []):
        fault_text = (
            f"{make} {model}, Known Fault: {fault['fault']}\n"
            f"Affects variants: {', '.join(fault.get('affects_variants', []))}\n"
            f"Mileage range: {fault['mileage_range']}\n"
            f"Severity: {fault['severity']}\n"
            f"Description: {fault['description']}\n"
            f"What to inspect: {fault['what_to_inspect']}\n"
            f"Estimated repair cost (ZAR): {fault['estimated_repair_zar']}\n"
            f"Source: {fault.get('source', sources_str)}"
        )
        chunks.append({
            "chunk_type": "fault",
            "make": make,
            "model": model,
            "fault_name": fault["fault"],
            "mileage_range": fault["mileage_range"],
            "severity": fault["severity"],
            "estimated_repair_zar": fault["estimated_repair_zar"],
            "text": fault_text,
            "source": fault.get("source", sources_str),
        })

    # --- What to inspect chunk ---
    inspect_items = car.get("what_to_inspect_before_buying", [])
    if inspect_items:
        inspect_text = (
            f"{make} {model} ,  What to Inspect Before Buying\n"
            + "\n".join(f"- {item}" for item in inspect_items)
        )
        chunks.append({
            "chunk_type": "inspection",
            "make": make,
            "model": model,
            "text": inspect_text,
            "source": sources_str,
        })

    return chunks


def make_vector_id(chunk: dict) -> str:
    key = f"{chunk['make']}_{chunk['model']}_{chunk['chunk_type']}_{chunk.get('fault_name', '')}_{chunk.get('year_from', '')}"
    return hashlib.md5(key.encode()).hexdigest()


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
        chunks = chunk_car_file(car)
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
            vector_id = make_vector_id(chunk)
            metadata = {k: v for k, v in chunk.items() if k != "text"}
            metadata["text"] = chunk["text"][:1000]  # Pinecone metadata limit
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": metadata,
            })

        pinecone_client.upsert(vectors)
        print(f"  -> Upserted {len(vectors)} vectors to Pinecone")

    print("\nIngestion complete!")


if __name__ == "__main__":
    asyncio.run(ingest_all())
