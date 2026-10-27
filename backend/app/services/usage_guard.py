"""Daily caps on paid LLM work (/query and WhatsApp).

Per-IP rate limits alone can't stop cost sabotage: IPs can be rotated (or
X-Forwarded-For spoofed behind the proxy). These caps bound the worst case
regardless of IP:

- every signed-in user gets their own daily allowance (keyed by user id,
  which can't be forged without the JWT secret)
- anonymous traffic shares one daily pool, so abuse there can't eat into
  signed-in users' allowance
- a hard total across everything is the final spend ceiling

Counters are in-memory and reset at UTC midnight (and on restart). Fine for
a single instance; move to the DB/Redis if the backend is ever scaled out.
"""
import threading
from datetime import datetime, timezone

from fastapi import HTTPException

from app.config import settings

_lock = threading.Lock()
_day = ""
_counts: dict[str, int] = {}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _reset_if_new_day() -> None:
    global _day
    today = _today()
    if today != _day:
        _day = today
        _counts.clear()


def consume(bucket: str, bucket_limit: int) -> None:
    """Count one LLM request against `bucket` and the global total.

    Raises 429 (nothing is counted) if either limit is already reached.
    """
    with _lock:
        _reset_if_new_day()
        total = _counts.get("total", 0)
        if total >= settings.total_daily_query_limit:
            raise HTTPException(
                429, detail="CarIQ has reached its daily question limit. Please try again tomorrow."
            )
        used = _counts.get(bucket, 0)
        if used >= bucket_limit:
            if bucket == "anon":
                detail = "Daily limit for guest questions reached. Sign in to keep asking."
            else:
                detail = "You've reached today's question limit. Please try again tomorrow."
            raise HTTPException(429, detail=detail)
        _counts[bucket] = used + 1
        _counts["total"] = total + 1


def consume_query(user_id: int | None) -> None:
    if user_id is None:
        consume("anon", settings.anon_daily_query_limit)
    else:
        consume(f"user:{user_id}", settings.user_daily_query_limit)


def consume_signup() -> None:
    """Global cap on new accounts per day, so mass sign-ups can't be used to
    multiply per-user query allowances."""
    with _lock:
        _reset_if_new_day()
        used = _counts.get("signups", 0)
        if used >= settings.daily_signup_limit:
            raise HTTPException(429, detail="Sign-ups are paused for today. Please try again tomorrow.")
        _counts["signups"] = used + 1


def reset() -> None:
    """Test helper."""
    with _lock:
        _counts.clear()
