import re
import asyncio
import time
import random
import logging
import uuid
from datetime import datetime
import anthropic
from app.config import settings
from app.db.database import SessionLocal
from app.db.models import ClaudeCallLog, ClaudeDeadLetter

logger = logging.getLogger(__name__)

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

# USD per million tokens, override with env vars if needed
MODEL_PRICING = {
    "claude-sonnet-4-6": {
        "input_per_mtok": 3.0,
        "output_per_mtok": 15.0,
    },
}


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


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = MODEL_PRICING.get(model, {})
    in_price = pricing.get("input_per_mtok", 0.0)
    out_price = pricing.get("output_per_mtok", 0.0)
    return (input_tokens / 1e6 * in_price) + (output_tokens / 1e6 * out_price)


def _write_log(db, call_id: str, feature: str, model: str, status: str, **kwargs) -> None:
    entry = ClaudeCallLog(
        call_id=call_id,
        feature=feature,
        model=model,
        status=status,
        **kwargs,
    )
    db.add(entry)
    db.commit()


def _write_dead_letter(db, call_id: str, feature: str, error: Exception, attempts: int) -> None:
    entry = ClaudeDeadLetter(
        call_id=call_id,
        feature=feature,
        error_type=type(error).__name__,
        error_message=str(error)[:2000],
        attempts=attempts,
    )
    db.add(entry)
    db.commit()


class ClaudeClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"
        self.max_retries = settings.claude_max_retries
        self.base_delay = settings.claude_base_delay

    async def generate(self, question: str, context: str, feature: str = "rag_query") -> str:
        safe_question = sanitise_for_prompt(question)
        user_message = f"""Context from CarIQ knowledge base:
{context}

User question: {safe_question}

Answer the question using only the context provided above. Be specific, practical, and honest."""

        call_id = str(uuid.uuid4())
        start = time.monotonic()
        last_error: Exception | None = None
        delay = self.base_delay

        for attempt in range(self.max_retries + 1):
            try:
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_message}],
                    extra_headers={"Idempotency-Key": call_id},
                )
                latency_ms = int((time.monotonic() - start) * 1000)
                input_tokens = getattr(message.usage, "input_tokens", 0)
                output_tokens = getattr(message.usage, "output_tokens", 0)

                db = SessionLocal()
                try:
                    _write_log(
                        db,
                        call_id=call_id,
                        feature=feature,
                        model=self.model,
                        status="success",
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        cost_usd=_estimate_cost(self.model, input_tokens, output_tokens),
                        latency_ms=latency_ms,
                    )
                except Exception:
                    logger.error("Failed to write API call log", exc_info=True)
                finally:
                    db.close()

                return message.content[0].text

            except (anthropic.APITimeoutError, anthropic.RateLimitError) as exc:
                last_error = exc
            except anthropic.APIStatusError as exc:
                if exc.status_code < 500:
                    raise
                last_error = exc
            except Exception as exc:
                raise

            if attempt < self.max_retries:
                logger.warning(
                    f"API call transient failure (attempt {attempt + 1}/{self.max_retries}): {last_error}"
                )
                await asyncio.sleep(delay + random.uniform(0, 0.5))
                delay *= 2
                continue
            break

        latency_ms = int((time.monotonic() - start) * 1000)
        db = SessionLocal()
        try:
            _write_log(
                db,
                call_id=call_id,
                feature=feature,
                model=self.model,
                status="failed",
                latency_ms=latency_ms,
                error=str(last_error) if last_error else "unknown",
            )
            _write_dead_letter(db, call_id, feature, last_error, self.max_retries + 1)
        except Exception:
            logger.error("Failed to write API failure/dead-letter log", exc_info=True)
        finally:
            db.close()

        raise last_error

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
