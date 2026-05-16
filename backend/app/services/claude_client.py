import re
import anthropic
from app.config import settings

SYSTEM_PROMPT = """You are CarIQ, a South African used car market intelligence assistant.

You answer questions about used car prices, reliability, and known faults for the South African market.

CRITICAL RULES:
1. Answer ONLY from the context provided. If the context does not contain enough information to answer, say: "I don't have enough data on that model yet. Try asking about VW Polo, Toyota Hilux, BMW 3 Series, or Ford Ranger."
2. Never fabricate prices, fault data, or statistics.
3. Always quote prices in South African Rand (ZAR / R).
4. When giving a price verdict, use exactly one of: GOOD DEAL / FAIR / ABOVE MARKET / OVERPRICED.
5. When listing known faults, always include: the fault name, the typical mileage range it appears, severity (LOW/MEDIUM/HIGH), and estimated repair cost in ZAR.
6. End every response with a "Sources:" line listing the KB sources used.
7. Be direct and practical. South African buyers want honest advice, not disclaimers.

You have deep knowledge of the SA used car market, common faults per model, and price trends for Johannesburg, Cape Town, and Durban."""


def sanitise_for_prompt(question: str) -> str:
    suspicious_patterns = [
        r"ignore (all )?(previous|prior|above) instructions",
        r"system prompt",
        r"you are now",
        r"forget everything",
        r"new instructions",
        r"disregard",
        r"jailbreak",
        r"act as",
        r"pretend (you are|to be)",
    ]
    lower = question.lower()
    for pattern in suspicious_patterns:
        if re.search(pattern, lower):
            raise ValueError("Invalid query content")
    return question


class ClaudeClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

    async def generate(self, question: str, context: str) -> str:
        safe_question = sanitise_for_prompt(question)
        user_message = f"""Context from CarIQ knowledge base:
{context}

User question: {safe_question}

Answer the question using only the context provided above. Be specific, practical, and honest."""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return message.content[0].text

    def ping(self) -> bool:
        try:
            self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            return True
        except Exception:
            return False
