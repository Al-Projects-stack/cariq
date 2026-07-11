"""Quick end-to-end RAG smoke test."""
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.embeddings import EmbeddingsService
from app.services.pinecone_client import PineconeClient
from app.services.claude_client import ClaudeClient


async def test():
    emb = EmbeddingsService()
    pc = PineconeClient()
    cl = ClaudeClient()

    q = "What are the known faults on a VW Polo Vivo?"
    print(f"Query: {q}\n")

    vec = await emb.embed(q)
    hits = await pc.search(vec, top_k=3)
    print(f"Retrieved {len(hits)} chunks from Pinecone:")
    for h in hits:
        meta = h["metadata"]
        print(f"  [{meta.get('chunk_type','?')}] {meta.get('make','')} {meta.get('model','')}, score {h['score']:.3f}")

    context = "\n\n".join(h["metadata"].get("text", "")[:300] for h in hits)
    answer = await cl.generate(q, context)
    print("\nClaude answer:")
    safe = answer[:600].encode("ascii", errors="replace").decode("ascii")
    print(safe)
    print("\nRAG pipeline OK")


asyncio.run(test())
