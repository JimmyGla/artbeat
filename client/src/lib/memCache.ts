/**
 * Lightweight in-memory cache with TTL.
 * Module-level singleton — survives React re-renders and route navigation.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data:      T
  timestamp: number
}

export class MemCache<T> {
  private readonly ttl: number
  private readonly store = new Map<string, CacheEntry<T>>()

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttl = ttlMs
  }

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, timestamp: Date.now() })
  }

  /** Remove all entries whose key starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  /** Remove a specific key. */
  invalidate(key: string): void {
    this.store.delete(key)
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear()
  }
}
