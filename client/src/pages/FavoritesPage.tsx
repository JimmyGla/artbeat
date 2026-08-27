import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import ExhibitionCard, { ExhibitionCardData } from '../components/ExhibitionCard'
import SaveButton from '../components/SaveButton'
import StatusBarScrim from '../components/StatusBarScrim'
import { SkeletonGrid } from '../components/Skeleton'
import { useAuth }  from '../context/AuthContext'
import { useSaved } from '../context/SavedContext'
import { useTitle } from '../hooks/useTitle'
import { API_BASE } from '../lib/api'
import { closingLabel, daysUntilClose, venueKindLabel } from '../lib/format'

/**
 * Saved, in two lists — which is the whole reason for having two verbs.
 *
 *   Places  — venues and permanent collections. Evergreen; no urgency.
 *   To see  — bookmarked shows, ordered by what closes soonest, because that
 *             is the only ordering that answers a question with a clock on it.
 *
 * Ended bookmarks move to Archive rather than lingering, so the live list stays
 * trustworthy without discarding history.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedVenue {
  id:       string
  name:     string
  kind:     string
  address:  string
  imageUrl: string | null
}

interface SavedResponse {
  places:   { id: string; venue: SavedVenue | null; exhibition: ExhibitionCardData | null }[]
  toSee:    { id: string; remindAt: string | null; exhibition: ExhibitionCardData }[]
  archived: { id: string; exhibition: ExhibitionCardData }[]
}

type Tab = 'places' | 'toSee'

interface VenueUpdate {
  id: string
  title: string
  imageUrl: string | null
  venue: { id: string; name: string } | null
}

const API = API_BASE

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignInPrompt() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-8 text-center">
      <svg className="w-28 h-28 mb-6 opacity-30" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <circle cx="60" cy="60" r="56" stroke="#6B7280" strokeWidth="2" strokeDasharray="6 4" />
        <path d="M60 80C60 80 30 62 30 44a18 18 0 0136 0 18 18 0 0136 0C102 62 60 80 60 80z" fill="#E5E7EB" />
      </svg>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Keep track of what you love</h1>
      <p className="text-sm text-gray-400 max-w-xs mb-8 leading-relaxed">
        Sign in to follow the places you care about and save shows before they close.
      </p>
      <button
        onClick={() => navigate('/login?redirect=/favorites')}
        className="w-full max-w-xs h-12 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        Sign in
      </button>
      <button
        onClick={() => navigate('/register?redirect=/favorites')}
        className="w-full max-w-xs h-12 mt-3 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
      >
        Create account
      </button>
    </div>
  )
}

/**
 * Empty states differ per tab, because the useful next action differs: an empty
 * Places invites browsing venues, an empty To see invites browsing what's on.
 * One shared empty state could only ever suit one of them.
 */
function EmptyTab({ tab }: { tab: Tab }) {
  const navigate = useNavigate()
  const places = tab === 'places'
  return (
    <div className="flex flex-col items-center px-8 pt-16 pb-10 text-center">
      <span className="text-5xl mb-4 opacity-30">{places ? '🏛' : '🔖'}</span>
      <h2 className="text-base font-bold text-gray-800 mb-1.5">
        {places ? 'No places yet' : 'Nothing on your list'}
      </h2>
      <p className="text-sm text-gray-400 max-w-xs mb-7 leading-relaxed">
        {places
          ? 'Tap the heart on a museum or gallery to keep it here.'
          : 'Bookmark a show and it will appear here, sorted by what closes first.'}
      </p>
      <button
        onClick={() => navigate(places ? '/discover?tab=venues' : '/discover')}
        className="px-7 h-11 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        {places ? 'Browse venues' : "See what's on"}
      </button>
    </div>
  )
}

function VenueRow({ venue }: { venue: SavedVenue }) {
  return (
    <Link
      to={`/venue/${venue.id}`}
      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-2.5 active:scale-[0.99] transition-transform"
    >
      <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
        {venue.imageUrl
          ? <img src={venue.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <span className="text-2xl opacity-40" aria-hidden="true">🏛</span>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-400 mb-0.5">{venueKindLabel(venue.kind)}</p>
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-1">{venue.name}</h3>
        <p className="text-xs text-gray-400 line-clamp-1">{venue.address}</p>
      </div>

      <SaveButton target={{ kind: 'venue', id: venue.id }} variant="plain" size="sm" />
    </Link>
  )
}

/** A bookmark row leads with time remaining — that is what it is for. */
function ToSeeRow({ exhibition }: { exhibition: ExhibitionCardData }) {
  const label = closingLabel(exhibition.endsOn)
  const days  = daysUntilClose(exhibition.endsOn)
  const urgent = days !== null && days <= 14

  return (
    <div className="relative">
      {label && (
        <div className={`flex items-center gap-1.5 px-1 pb-1.5 text-xs font-bold ${
          urgent ? 'text-amber-600' : 'text-gray-400'
        }`}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 7v5l3 2" />
          </svg>
          {label}
        </div>
      )}
      <ExhibitionCard exhibition={exhibition} />
    </div>
  )
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-2">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const { user, loading: authLoading, authFetch } = useAuth()
  const { loading: savedLoading } = useSaved()

  const [data,    setData]    = useState<SavedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('toSee')
  const [showArchive, setShowArchive] = useState(false)
  const [updates, setUpdates] = useState<VenueUpdate[]>([])
  const navigate = useNavigate()

  useTitle('Saved', 'The places you follow and the shows you mean to catch.')

  const load = useCallback(async () => {
    if (!user) { setData(null); setLoading(false); return }
    setLoading(true)
    try {
      const r = await authFetch(`${API}/api/saved`)
      if (!r.ok) throw new Error('Failed to load saved items')
      setData(await r.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch])

  useEffect(() => { void load() }, [load])

  // New shows at hearted venues. Fetched separately so a failure here leaves
  // the saved lists intact — this is an extra, not the point of the screen.
  useEffect(() => {
    if (!user) { setUpdates([]); return }
    authFetch(`${API}/api/saved/updates`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { updates: VenueUpdate[] }) => setUpdates(d.updates))
      .catch((err) => console.warn('[favorites] updates unavailable', err))
  }, [user, authFetch])

  // Clearing is deliberate and one-way: marked read only once the user is
  // actually looking at the list, never on mere page load.
  const dismissUpdates = useCallback(() => {
    setUpdates([])
    authFetch(`${API}/api/saved/updates/seen`, { method: 'POST' })
      .catch((err) => console.warn('[favorites] could not mark updates seen', err))
  }, [authFetch])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <SignInPrompt />
  if (loading || savedLoading || !data) return <SkeletonGrid count={4} />

  const places = data.places
  const toSee  = data.toSee
  const counts = { places: places.length, toSee: toSee.length }

  return (
    <div className="bg-gray-50 min-h-dvh overflow-y-auto pb-[calc(var(--nav-h)+1.5rem)]">
      {/* The header scrolls away here (unlike Discover's sticky one), so cards
          would slide up into the status bar and collide with the clock. */}
      <StatusBarScrim className="bg-gray-50" />
      <div className="px-4 pb-2" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <h1 className="text-2xl font-bold text-gray-900">Saved</h1>
      </div>

      {/* Two lists, because the two verbs mean different things. */}
      <div role="tablist" aria-label="Saved items" className="flex gap-1 mx-4 mb-3 bg-gray-100 rounded-xl p-1">
        {([
          ['toSee',  'To see', counts.toSee],
          ['places', 'Places', counts.places],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs font-bold px-1.5 rounded-full ${
                tab === key ? 'bg-brand-50 text-brand-600' : 'bg-gray-200 text-gray-500'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4">
        {tab === 'toSee' && (
          toSee.length === 0 ? <EmptyTab tab="toSee" /> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {toSee.map(({ id, exhibition }) => <ToSeeRow key={id} exhibition={exhibition} />)}
              </div>

              {/* Ended shows are kept, just out of the way. */}
              {data.archived.length > 0 && (
                <div className="mt-7">
                  <button
                    onClick={() => setShowArchive((v) => !v)}
                    aria-expanded={showArchive}
                    className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-600 min-h-[40px]"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showArchive ? 'rotate-90' : ''}`}
                         fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    Closed ({data.archived.length})
                  </button>

                  {showArchive && (
                    <div className="grid grid-cols-2 gap-3 mt-2 opacity-60">
                      {data.archived.map(({ id, exhibition }) => <ExhibitionCard key={id} exhibition={exhibition} />)}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}

        {tab === 'places' && (
          places.length === 0 ? <EmptyTab tab="places" /> : (
            <div className="flex flex-col gap-5">
              {/* The payoff for following a venue: something new opened there.
                  Sits above the list because it is the only part of this screen
                  the user has not seen before. */}
              {updates.length > 0 && (
                <section className="rounded-2xl bg-brand-50 border border-brand-100 p-3">
                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                    <h2 className="text-sm font-semibold text-brand-900">
                      New at your places
                    </h2>
                    <button
                      onClick={dismissUpdates}
                      className="text-xs font-medium text-brand-600 px-2 py-1 -mr-1 rounded-lg active:bg-brand-100"
                    >
                      Mark as read
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {updates.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => navigate(`/exhibition/${u.id}`)}
                        className="flex items-center gap-3 text-left p-1.5 rounded-xl active:bg-brand-100/60"
                      >
                        {u.imageUrl ? (
                          <img
                            src={u.imageUrl}
                            alt=""
                            loading="lazy"
                            className="w-11 h-11 rounded-lg object-cover shrink-0 bg-brand-100"
                          />
                        ) : (
                          <span className="w-11 h-11 rounded-lg bg-brand-100 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900 truncate">{u.title}</span>
                          {u.venue && (
                            <span className="block text-xs text-gray-500 truncate">{u.venue.name}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {places.some((p) => p.venue) && (
                <section>
                  <SectionHeading label="Venues" count={places.filter((p) => p.venue).length} />
                  <div className="flex flex-col gap-2.5">
                    {places.filter((p) => p.venue).map((p) => (
                      <VenueRow key={p.id} venue={p.venue!} />
                    ))}
                  </div>
                </section>
              )}

              {places.some((p) => p.exhibition) && (
                <section>
                  <SectionHeading label="Permanent collections" count={places.filter((p) => p.exhibition).length} />
                  <div className="grid grid-cols-2 gap-3">
                    {places.filter((p) => p.exhibition).map((p) => (
                      <ExhibitionCard key={p.id} exhibition={p.exhibition!} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
