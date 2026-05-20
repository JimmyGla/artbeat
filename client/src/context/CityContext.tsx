import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CityData {
  id:         string
  name:       string
  slug:       string
  country:    string
  lat:        number
  lng:        number
  zoomLevel:  number
  isActive:   boolean
  venueCount: number
}

interface CityContextType {
  citySlug:     string
  city:         CityData | null
  /** All cities returned by the API (active + inactive) */
  allCities:    CityData[]
  /** Only active cities — use for map defaults, navigation guards, etc. */
  activeCities: CityData[]
  setCity:      (slug: string) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const CityContext = createContext<CityContextType | null>(null)

const STORAGE_KEY = 'artbeat_city'
const API         = API_BASE

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CityProvider({ children }: { children: ReactNode }) {
  const [allCities, setAllCities] = useState<CityData[]>([])
  const [citySlug,  setCitySlug]  = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'milan',
  )

  useEffect(() => {
    fetch(`${API}/api/cities`)
      .then((r) => r.json())
      .then((data: CityData[]) => setAllCities(data))
      .catch(console.error)
  }, [])

  const setCity = (slug: string) => {
    localStorage.setItem(STORAGE_KEY, slug)
    setCitySlug(slug)
  }

  const city         = allCities.find((c) => c.slug === citySlug) ?? null
  const activeCities = useMemo(() => allCities.filter((c) => c.isActive), [allCities])

  return (
    <CityContext.Provider value={{ citySlug, city, allCities, activeCities, setCity }}>
      {children}
    </CityContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCity(): CityContextType {
  const ctx = useContext(CityContext)
  if (!ctx) throw new Error('useCity must be used inside <CityProvider>')
  return ctx
}
