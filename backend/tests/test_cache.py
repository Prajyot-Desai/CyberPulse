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
