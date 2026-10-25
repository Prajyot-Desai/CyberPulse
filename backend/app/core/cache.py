"""In-memory TTL cache with stale-data retention and async concurrency safety."""

import asyncio
from datetime import datetime, timezone
import time
from typing import Any, Dict, Optional, Tuple


class CacheEntry:
    """Internal container for cached item, expiration timestamp, and metadata."""

    def __init__(
        self,
        value: Any,
        ttl_seconds: int,
        max_stale_seconds: int = 86400,
        now_mono: Optional[float] = None,
    ):
        now = now_mono if now_mono is not None else time.monotonic()
        self.value = value
        self.created_at_wall = datetime.now(timezone.utc)
        self.created_at_mono = now
        self.expires_at_mono = now + ttl_seconds
        self.max_stale_seconds = max_stale_seconds
        self.stale_until_mono = now + max_stale_seconds

    @property
    def is_expired(self) -> bool:
        """Return True if current time exceeds monotonic expiration time."""
        return time.monotonic() >= self.expires_at_mono

    def is_expired_at(self, now_mono: float) -> bool:
        """Return True if specified monotonic time exceeds expiration time."""
        return now_mono >= self.expires_at_mono

    @property
    def is_stale_expired(self) -> bool:
        """Return True if current time exceeds maximum allowed stale retention window."""
        return time.monotonic() >= self.stale_until_mono

    def is_stale_expired_at(self, now_mono: float) -> bool:
        """Return True if specified monotonic time exceeds maximum allowed stale retention window."""
        return now_mono >= self.stale_until_mono


class InMemoryTTLCache:
    """Thread-safe and async-aware in-memory cache supporting TTL, bounded stale fallback, and clock injection."""

    def __init__(
        self,
        default_ttl_seconds: int = 900,
        max_stale_seconds: int = 86400,
        time_func: Optional[Any] = None,
    ):
        self.default_ttl = default_ttl_seconds
        self.max_stale_seconds = max_stale_seconds
        self._time_func = time_func if time_func is not None else time.monotonic
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

        now = self._time_func()
        if entry.is_stale_expired_at(now):
            self._entries.pop(key, None)
            self._misses += 1
            return None

        if entry.is_expired_at(now):
            self._misses += 1
            return None

        self._hits += 1
        return entry.value

    def get_with_status(self, key: str) -> Tuple[Optional[Any], bool, Optional[datetime]]:
        """
        Retrieve value and whether it is stale.

        Returns:
            (value, is_stale, created_at_utc)
            If key does not exist or has exceeded max_stale_seconds, returns (None, False, None).
        """
        entry = self._entries.get(key)
        if entry is None:
            self._misses += 1
            return None, False, None

        now = self._time_func()
        if entry.is_stale_expired_at(now):
            # Expired beyond max stale age: evict and treat as unavailable/miss
            self._entries.pop(key, None)
            self._misses += 1
            return None, False, None

        if entry.is_expired_at(now):
            # Entry exists but is past TTL -> Stale (within max stale age)
            return entry.value, True, entry.created_at_wall

        self._hits += 1
        return entry.value, False, entry.created_at_wall

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None,
        max_stale_seconds: Optional[int] = None,
    ) -> None:
        """Store a value with a specific or default TTL and maximum stale retention window."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        max_stale = (
            max_stale_seconds if max_stale_seconds is not None else self.max_stale_seconds
        )
        now = self._time_func()
        self._entries[key] = CacheEntry(
            value=value,
            ttl_seconds=ttl,
            max_stale_seconds=max_stale,
            now_mono=now,
        )

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
        now = self._time_func()
        expired_keys = [k for k, e in self._entries.items() if e.is_stale_expired_at(now)]
        for k in expired_keys:
            self._entries.pop(k, None)

        active_entries = sum(1 for e in self._entries.values() if not e.is_expired_at(now))
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
