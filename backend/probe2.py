import asyncio
import traceback

from app.services.pinecone_client import PineconeClient
from app.services.claude_client import ClaudeClient


async def main():
    print("== Pinecone search ==")
    try:
        pc = PineconeClient()
        results = await pc.search(vector=[0.0] * 384, top_k=2)
        print("OK, matches:", len(results))
    except Exception:
        traceback.print_exc()

    print("\n== Claude generate ==")
    try:
        c = ClaudeClient()
        answer = c.generate(
            question="How much is a 2019 VW Polo used?",
            context="No relevant knowledge base entries found.",
        )
        print("OK:", answer[:300])
    except Exception:
        traceback.print_exc()


asyncio.run(main())
