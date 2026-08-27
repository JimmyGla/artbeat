import { useState, useCallback } from 'react'
import { Geolocation } from '@capacitor/geolocation'

/**
 * The user's position, asked for explicitly.
 *
 * Extracted from MapPage so Discover's "Near me" behaves identically: the
 * permission is asked for once by the OS, and two screens with slightly
 * different handling would give the same denial two different outcomes.
 *
 * Location is never requested on mount. It is requested when the user asks to
 * be located — a cold prompt with no visible reason is the most likely to be
 * denied, and iOS remembers a denial.
 */

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'error'

/** How long to wait for a fix before giving up and telling the user. */
const LOCATE_TIMEOUT_MS = 10_000

/**
 * Reject if `promise` has not settled in time.
 *
 * A GPS fix can legitimately take seconds, but "never" is not an acceptable
 * outcome for a button the user is watching.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('location timed out')), ms),
    ),
  ])
}

export interface UserLocation {
  coords: { lat: number; lng: number } | null
  status: LocationStatus
  /** Returns the coordinates, or null if unavailable for any reason. */
  locate: () => Promise<{ lat: number; lng: number } | null>
  clear: () => void
}

export function useUserLocation(): UserLocation {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<LocationStatus>('idle')

  const locate = useCallback(async () => {
    setStatus('locating')
    try {
      // Asked explicitly rather than relying on the implicit web prompt: on iOS
      // this surfaces the native dialog and lets a denial be reported clearly
      // instead of appearing as a hang.
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') perm = await Geolocation.requestPermissions()
      if (perm.location !== 'granted') {
        setStatus('denied')
        return null
      }

      // The plugin's own `timeout` is not reliable — on the iOS simulator
      // getCurrentPosition can hang indefinitely and never settle, which left
      // the Near-me button stuck on "Locating…" with no way back. So the
      // deadline is enforced here, where it cannot be ignored.
      const pos = await withTimeout(
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS }),
        LOCATE_TIMEOUT_MS,
      )
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setCoords(next)
      setStatus('granted')
      return next
    } catch {
      setStatus('error')
      return null
    }
  }, [])

  const clear = useCallback(() => {
    setCoords(null)
    setStatus('idle')
  }, [])

  return { coords, status, locate, clear }
}

/** "450 m" / "1.2 km" — metres below a kilometre, one decimal above. */
export function distanceLabel(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return ''
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`
}
