import { useState, useCallback } from 'react'

const STORAGE_KEY = 'artbeat_favorites'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function save(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
}

/**
 * Persists a set of favourite event IDs in localStorage.
 * Returns { favorites, toggle, isFavorite }.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load)

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      save(next)
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (id: string) => favorites.has(id),
    [favorites],
  )

  return { favorites, toggle, isFavorite }
}
