import time
from threading import Lock


class TTLCache:
    def __init__(self, maxsize: int = 256, ttl: int = 300):
        self._maxsize = maxsize
        self._ttl = ttl
        self._data: dict = {}
        self._expires: dict = {}
        self._lock = Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str):
        with self._lock:
            if key not in self._data:
                self._misses += 1
                return None
            if time.monotonic() > self._expires[key]:
                del self._data[key]
                del self._expires[key]
                self._misses += 1
                return None
            self._hits += 1
            return self._data[key]

    def set(self, key: str, value) -> None:
        with self._lock:
            if len(self._data) >= self._maxsize:
                oldest = min(self._expires, key=lambda k: self._expires[k])
                del self._data[oldest]
                del self._expires[oldest]
            self._data[key] = value
            self._expires[key] = time.monotonic() + self._ttl

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)
            self._expires.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self._expires.clear()
            self._hits = 0
            self._misses = 0

    @property
    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._data),
                "maxsize": self._maxsize,
                "ttl": self._ttl,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total, 3) if total else 0,
            }


# Global named caches
all_models_cache = TTLCache(maxsize=2, ttl=600)    # list of all models, 10 min
model_profile_cache = TTLCache(maxsize=256, ttl=600)  # individual profiles, 10 min
rag_query_cache = TTLCache(maxsize=128, ttl=120)      # RAG queries, 2 min
compare_cache = TTLCache(maxsize=64, ttl=600)         # comparisons, 10 min
market_cache = TTLCache(maxsize=64, ttl=600)          # market position, 10 min
tco_cache = TTLCache(maxsize=64, ttl=600)             # TCO estimates, 10 min
recommend_cache = TTLCache(maxsize=32, ttl=300)       # recommendations, 5 min
