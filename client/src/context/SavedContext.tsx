import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { API_BASE } from '../lib/api'
import { syncReminders, cancelReminder, type ReminderInput } from '../lib/reminders'
import { track } from '../lib/telemetry'

/**
 * Saving, in two verbs.
 *
 *   heart    → taste. Venues and permanent runs: things that persist.
 *   bookmark → intent. Temporary runs: a task with a closing date.
 *
 * Callers never choose between them. They hand over the thing being saved and
 * `verbFor` derives the verb from its nature — the same rule the API enforces.
 * That is what keeps a heart and a bookmark from ever appearing on the same
 * card, which is the usual way two save actions become confusing.
 */

export type SaveTarget =
  | { kind: 'venue'; id: string }
  | { kind: 'exhibition'; id: string; run: 'PERMANENT' | 'TEMPORARY' }

export type SaveVerb = 'heart' | 'bookmark'

/** The object decides. A place or a permanent collection is hearted; anything with a deadline is bookmarked. */
export function verbFor(target: SaveTarget): SaveVerb {
  if (target.kind === 'venue') return 'heart'
  return target.run === 'PERMANENT' ? 'heart' : 'bookmark'
}

interface SavedContextType {
  isSaved:   (target: SaveTarget) => boolean
  /** Returns false when the action was refused (not signed in). */
  toggleSave: (target: SaveTarget, onUnauthenticated?: () => void) => boolean
  verbFor:   (target: SaveTarget) => SaveVerb
  counts:    { places: number; toSee: number }
  loading:   boolean
}

const SavedContext = createContext<SavedContextType | null>(null)
const API = API_BASE

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user, authFetch } = useAuth()

  const [venueIds,     setVenueIds]     = useState<Set<string>>(new Set())
  const [exhibitionIds, setExhibitionIds] = useState<Set<string>>(new Set())
  const [bookmarkIds,  setBookmarkIds]  = useState<Set<string>>(new Set())
  // Bookmarks whose run has ended. A subset of bookmarkIds, never a separate
  // list: the full set still drives the save button, this only adjusts counts.
  const [archivedIds,  setArchivedIds]  = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(false)

  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500)
  }, [])

  // Only the identifiers on start-up — cards need to know their state without
  // pulling every full record.
  useEffect(() => {
    if (!user) {
      setVenueIds(new Set()); setExhibitionIds(new Set())
      setBookmarkIds(new Set()); setArchivedIds(new Set())
      return
    }

    setLoading(true)
    authFetch(`${API}/api/saved/ids`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch saved ids')
        return r.json()
      })
      .then((d: { venueIds: string[]; exhibitionIds: string[]; bookmarkedIds: string[]; archivedIds?: string[] }) => {
        setVenueIds(new Set(d.venueIds))
        setExhibitionIds(new Set(d.exhibitionIds))
        setBookmarkIds(new Set(d.bookmarkedIds))
        // Optional so an older server (or a cached response) simply reports
        // nothing archived rather than breaking the screen.
        setArchivedIds(new Set(d.archivedIds ?? []))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, authFetch])

  /**
   * Rebuild the device's reminder queue from the server's bookmark list.
   *
   * Refetched rather than derived from local state because the schedule needs
   * closing dates, which `/ids` does not carry, and because the server is the
   * only place that knows about bookmarks made on another device.
   *
   * `prompt` is true only when the user just bookmarked something — that is the
   * one moment when asking to send reminders makes sense.
   */
  const refreshReminders = useCallback(
    (prompt = false) => {
      authFetch(`${API}/api/saved/reminders`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { reminders: ReminderInput[] }) => syncReminders(d.reminders, { prompt }))
        .catch((err) => console.warn('[saved] reminder sync skipped', err))
    },
    [authFetch],
  )

  // Reminders are scheduled per-device, so they must be re-synced on every
  // launch: a fresh install has an empty queue, and reminders for bookmarks
  // dropped elsewhere are still sitting in this one.
  useEffect(() => {
    if (user) refreshReminders(false)
  }, [user, refreshReminders])

  const setFor = useCallback((target: SaveTarget) => {
    if (target.kind === 'venue') return { get: venueIds, set: setVenueIds }
    return verbFor(target) === 'heart'
      ? { get: exhibitionIds, set: setExhibitionIds }
      : { get: bookmarkIds, set: setBookmarkIds }
  }, [venueIds, exhibitionIds, bookmarkIds])

  const isSaved = useCallback(
    (target: SaveTarget) => setFor(target).get.has(target.id),
    [setFor],
  )

  const toggleSave = useCallback(
    (target: SaveTarget, onUnauthenticated?: () => void): boolean => {
      if (!user) {
        if (onUnauthenticated) onUnauthenticated()
        else showToast(verbFor(target) === 'heart' ? 'Sign in to save places' : 'Sign in to save exhibitions')
        return false
      }

      const { get, set } = setFor(target)
      const wasSaved = get.has(target.id)

      const flip = (add: boolean) => set((prev) => {
        const next = new Set(prev)
        add ? next.add(target.id) : next.delete(target.id)
        return next
      })

      flip(!wasSaved) // optimistic

      const verb = verbFor(target)
      const url =
        verb === 'bookmark'
          ? wasSaved ? `${API}/api/saved/bookmarks/${target.id}` : `${API}/api/saved/bookmarks`
          : target.kind === 'venue'
            ? wasSaved ? `${API}/api/saved/favorites/venue/${target.id}` : `${API}/api/saved/favorites`
            : wasSaved ? `${API}/api/saved/favorites/exhibition/${target.id}` : `${API}/api/saved/favorites`

      const request = wasSaved
        ? authFetch(url, { method: 'DELETE' })
        : authFetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(
              verb === 'bookmark'
                ? { exhibitionId: target.id }
                : target.kind === 'venue'
                  ? { venueId: target.id }
                  : { exhibitionId: target.id },
            ),
          })

      request
        .then((r) => {
          if (!r.ok && r.status !== 204) {
            console.warn('[saved] sync failed — rolling back', r.status)
            flip(wasSaved)
            return
          }

          // Which verb gets used answers whether the heart/bookmark split
          // earns its complexity. The target's kind and verb are recorded, not
          // which exhibition — what someone likes is theirs.
          track(wasSaved ? 'saved_removed' : 'saved_added', {
            verb: verb,
            target: target.kind,
          })

          // Only bookmarks carry a deadline, so only they have a reminder.
          // Done after the request lands, not optimistically: a reminder for a
          // bookmark the server rejected would fire for something unsaved.
          if (verb === 'bookmark') {
            if (wasSaved) {
              cancelReminder(target.id)
              // Removing a *closed* bookmark from the archive shrinks the total
              // but must not change "to see". Without this the count would go
              // up by one — the opposite of what just happened.
              setArchivedIds((prev) => {
                if (!prev.has(target.id)) return prev
                const next = new Set(prev)
                next.delete(target.id)
                return next
              })
            } else {
              refreshReminders(true)
            }
          }
        })
        .catch(() => flip(wasSaved))

      return true
    },
    [user, setFor, authFetch, showToast, refreshReminders],
  )

  return (
    <SavedContext.Provider
      value={{
        isSaved,
        toggleSave,
        verbFor,
        counts: {
          places: venueIds.size + exhibitionIds.size,
          // Only what can still be seen. Counting closed shows here is what
          // made Profile say 5 while the Saved screen said 3 about the very
          // same bookmarks — a closed exhibition is not something "to see".
          toSee:  bookmarkIds.size - archivedIds.size,
        },
        loading,
      }}
    >
      {children}

      <div
        aria-live="polite"
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap transition-all duration-300 ${
          toastVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {toast}
      </div>
    </SavedContext.Provider>
  )
}

export function useSaved(): SavedContextType {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>')
  return ctx
}
