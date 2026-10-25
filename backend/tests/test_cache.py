"""Tests for InMemoryTTLCache functionality, expiration, and stale fallback."""

import asyncio
import time
import pytest
from app.core.cache import InMemoryTTLCache


def test_cache_set_and_get() -> None:
    """Verify standard item caching and retrieval."""
    cache = InMemoryTTLCache(default_ttl_seconds=60)
    cache.set("key1", {"metric": 100})

    result = cache.get("key1")
    assert result == {"metric": 100}
    stats = cache.stats()
    assert stats["hits"] == 1
    assert stats["misses"] == 0


def test_cache_miss() -> None:
    """Verify non-existent key returns None and increments misses."""
    cache = InMemoryTTLCache(default_ttl_seconds=60)
    assert cache.get("non_existent") is None
    stats = cache.stats()
    assert stats["misses"] == 1


def test_cache_expiration() -> None:
    """Verify that an expired key returns None via standard get."""
    cache = InMemoryTTLCache(default_ttl_seconds=1)
    # Set with 0-second TTL to instantly expire
    cache.set("quick_key", "value", ttl_seconds=0)

    # get() should return None because it's expired
    assert cache.get("quick_key") is None


def test_cache_stale_fallback() -> None:
    """Verify get_with_status retains last known good value when expired."""
    cache = InMemoryTTLCache(default_ttl_seconds=1)
    cache.set("stale_key", {"data": "valuable"}, ttl_seconds=0)

    value, is_stale, created_at = cache.get_with_status("stale_key")
    assert value == {"data": "valuable"}
    assert is_stale is True
    assert created_at is not None


def test_cache_delete_and_clear() -> None:
    """Verify deletion and clear."""
    cache = InMemoryTTLCache()
    cache.set("k1", 1)
    cache.set("k2", 2)

    assert cache.delete("k1") is True
    assert cache.get("k1") is None
    assert cache.get("k2") == 2

    cache.clear()
    assert cache.get("k2") is None
    assert cache.stats()["total_entries"] == 0


@pytest.mark.asyncio
async def test_cache_key_locks() -> None:
    """Verify concurrent tasks obtain coordinated locks for the same key."""
    cache = InMemoryTTLCache()
    lock1 = await cache.get_key_lock("resource_1")
    lock2 = await cache.get_key_lock("resource_1")
    lock3 = await cache.get_key_lock("resource_2")

    assert lock1 is lock2
    assert lock1 is not lock3


def test_bounded_stale_cache_expiration_with_controllable_clock() -> None:
    """Verify fresh TTL and max stale age boundaries using a synthetic clock."""
    current_time = 10000.0

    def fake_clock() -> float:
        return current_time

    # Default TTL: 900s (15 min), Max stale: 86400s (24 hours)
    cache = InMemoryTTLCache(
        default_ttl_seconds=900,
        max_stale_seconds=86400,
        time_func=fake_clock,
    )
    cache.set("key_bounded", {"status": "ok"})

    # 1. Immediate retrieval: Fresh
    assert cache.get("key_bounded") == {"status": "ok"}
    val, is_stale, created_at = cache.get_with_status("key_bounded")
    assert val == {"status": "ok"}
    assert is_stale is False
    assert created_at is not None

    # 2. Advance clock past fresh TTL (901 seconds), but well within 24 hours
    current_time += 901.0
    assert cache.get("key_bounded") is None  # Standard get rejects stale
    val, is_stale, _ = cache.get_with_status("key_bounded")
    assert val == {"status": "ok"}
    assert is_stale is True  # Servable as stale fallback

    # 3. Advance clock past maximum stale age (24 hours + 1 second from creation)
    # Total elapsed from start = 86401.0 seconds
    current_time = 10000.0 + 86401.0
    val, is_stale, _ = cache.get_with_status("key_bounded")
    assert val is None  # Bounded stale age rejects old entry
    assert is_stale is False

    # Eviction confirmed
    assert cache.stats()["total_entries"] == 0
