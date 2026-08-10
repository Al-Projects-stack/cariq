import asyncio
import traceback
from app.services.rag import RAGService


async def main():
    try:
        r = await RAGService().query(
            "How much is a 2019 VW Polo used?",
            "3f2a1c9e-7b4d-4f8e-9a2c-1d5e6f7a8b9c",
        )
        print("OK:", r.answer[:500])
    except Exception:
        traceback.print_exc()


asyncio.run(main())
