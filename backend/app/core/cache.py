"""In-memory TTL cache with stale-data retention and async concurrency safety."""

import asyncio
from datetime import datetime, timezone
import time
from typing import Any, Dict, Optional, Tuple


class CacheEntry:
    """Internal container for cached item, expiration timestamp, and metadata."""

    def __init__(self, value: Any, ttl_seconds: int):
        now = time.monotonic()
        self.value = value
        self.created_at_wall = datetime.now(timezone.utc)
        self.created_at_mono = now
        self.expires_at_mono = now + ttl_seconds

    @property
    def is_expired(self) -> bool:
        """Return True if current time exceeds monotonic expiration time."""
        return time.monotonic() >= self.expires_at_mono


class InMemoryTTLCache:
    """Thread-safe and async-aware in-memory cache supporting TTL and stale fallback."""

    def __init__(self, default_ttl_seconds: int = 900):
        self.default_ttl = default_ttl_seconds
        self._entries: Dict[str, CacheEntry] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._master_lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    async def get_key_lock(self, key: str) -> asyncio.Lock:
        """Return an asyncio.Lock specific to a key to prevent stampedes on concurrent fetches."""
        async with self._master_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    def get(self, key: str) -> Optional[Any]:
        """Retrieve value only if it exists and has not expired."""
        entry = self._entries.get(key)
        if entry is None:
            self._misses += 1
            return None

        if entry.is_expired:
            self._misses += 1
            return None

        self._hits += 1
        return entry.value

    def get_with_status(self, key: str) -> Tuple[Optional[Any], bool, Optional[datetime]]:
        """
        Retrieve value and whether it is stale.

        Returns:
            (value, is_stale, created_at_utc)
            If key does not exist at all, returns (None, False, None).
        """
        entry = self._entries.get(key)
        if entry is None:
            self._misses += 1
            return None, False, None

        if entry.is_expired:
            # Entry exists but is past TTL -> Stale
            return entry.value, True, entry.created_at_wall

        self._hits += 1
        return entry.value, False, entry.created_at_wall

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Store a value with a specific or default TTL."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        self._entries[key] = CacheEntry(value=value, ttl_seconds=ttl)

    def delete(self, key: str) -> bool:
        """Remove an item from cache if present."""
        return self._entries.pop(key, None) is not None

    def clear(self) -> None:
        """Reset all cache entries and stats."""
        self._entries.clear()
        self._hits = 0
        self._misses = 0

    def stats(self) -> Dict[str, Any]:
        """Return operational metrics for cache monitoring."""
        now = time.monotonic()
        active_entries = sum(1 for e in self._entries.values() if not e.is_expired)
        stale_entries = len(self._entries) - active_entries
        return {
            "total_entries": len(self._entries),
            "active_entries": active_entries,
            "stale_entries": stale_entries,
            "hits": self._hits,
            "misses": self._misses,
        }


# Global cache instance for the application
cache = InMemoryTTLCache()
