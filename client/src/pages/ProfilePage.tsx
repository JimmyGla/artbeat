import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate }   from 'react-router-dom'
import { useAuth }       from '../context/AuthContext'
import { useFavorites }  from '../context/FavoritesContext'
import { useCity }       from '../context/CityContext'
import { API_BASE }      from '../lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const API         = API_BASE
const APP_VERSION = '0.1.0'
const NOTIF_KEY   = 'artbeat_notifications'
const LANG_KEY    = 'artbeat_language'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return email[0].toUpperCase()
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  avatarUrl, name, email, size = 72,
}: {
  avatarUrl: string | null; name: string | null; email: string; size?: number
}) {
  const [imgErr, setImgErr] = useState(false)
  const initials = getInitials(name, email)

  if (avatarUrl && !imgErr) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? email}
        onError={() => setImgErr(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 bg-brand-600 text-white font-bold select-none"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

// ─── Row item (for list sections) ────────────────────────────────────────────

function RowItem({
  icon, label, right, onClick, danger = false, border = true,
}: {
  icon:     React.ReactNode
  label:    string
  right?:   React.ReactNode
  onClick?: () => void
  danger?:  boolean
  border?:  boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors ${
        onClick ? 'hover:bg-gray-50 active:bg-gray-100' : 'cursor-default'
      } ${border ? 'border-b border-gray-100 last:border-0' : ''}`}
    >
      <span className={`shrink-0 ${danger ? 'text-red-500' : 'text-gray-400'}`}>
        {icon}
      </span>
      <span className={`flex-1 text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-800'}`}>
        {label}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </button>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-4 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {children}
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        on ? 'bg-brand-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-10">
          {children}
        </div>
      </div>
    </>
  )
}

// ─── Centered modal ───────────────────────────────────────────────────────────

function Modal({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 bg-white rounded-3xl shadow-2xl transition-all duration-200 ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      aria-live="polite"
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate                         = useNavigate()
  const { user, loading, logout, authFetch, updateUser } = useAuth()
  const { favoritedIds }                 = useFavorites()
  const { allCities, citySlug, setCity } = useCity()

  // ── Preferences (localStorage) ────────────────────────────────────────────
  const [notifOn,  setNotifOn]  = useState(() => localStorage.getItem(NOTIF_KEY) !== 'false')
  const [language, setLanguage] = useState(() => localStorage.getItem(LANG_KEY) ?? 'en')

  // ── Favorites stats ───────────────────────────────────────────────────────
  const [citiesExplored, setCitiesExplored] = useState(0)

  useEffect(() => {
    if (!user || favoritedIds.size === 0) { setCitiesExplored(0); return }
    authFetch(`${API}/api/favorites`)
      .then((r) => r.json())
      .then((events: { venue?: { citySlug?: string } }[]) => {
        const slugs = new Set(events.map((e) => e.venue?.citySlug).filter(Boolean))
        // Fallback: count the current city if we have any favorites
        setCitiesExplored(slugs.size || (favoritedIds.size > 0 ? 1 : 0))
      })
      .catch(() => setCitiesExplored(favoritedIds.size > 0 ? 1 : 0))
  }, [user, favoritedIds.size, authFetch])

  // ── Edit profile sheet ────────────────────────────────────────────────────
  const [editOpen,       setEditOpen]       = useState(false)
  const [editName,       setEditName]       = useState('')
  const [editAvatarUrl,  setEditAvatarUrl]  = useState('')
  const [editLoading,    setEditLoading]    = useState(false)
  const [editError,      setEditError]      = useState('')

  function openEdit() {
    setEditName(user?.name ?? '')
    setEditAvatarUrl(user?.avatarUrl ?? '')
    setEditError('')
    setEditOpen(true)
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault()
    setEditError('')
    setEditLoading(true)
    try {
      const body: Record<string, string | null> = {}
      if (editName.trim())      body.name      = editName.trim()
      if (editAvatarUrl.trim()) body.avatarUrl = editAvatarUrl.trim()
      else                       body.avatarUrl = null

      const r = await authFetch(`${API}/api/users/me`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error ?? 'Update failed')
      }
      const updated = await r.json()
      updateUser(updated)
      setEditOpen(false)
      showToast('Profile updated')
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Suggest event modal ───────────────────────────────────────────────────
  const [suggestOpen,   setSuggestOpen]   = useState(false)
  const [suggestName,   setSuggestName]   = useState('')
  const [suggestUrl,    setSuggestUrl]    = useState('')
  const [suggestSent,   setSuggestSent]   = useState(false)

  function handleSuggestSend() {
    const subject = encodeURIComponent(`ArtBeat event suggestion: ${suggestName}`)
    const body    = encodeURIComponent(
      `Event name: ${suggestName}\nLink / details: ${suggestUrl}\n\nSuggested via ArtBeat v${APP_VERSION}`,
    )
    window.open(`mailto:hello@artbeat.app?subject=${subject}&body=${body}`)
    setSuggestSent(true)
    setTimeout(() => { setSuggestOpen(false); setSuggestSent(false) }, 1500)
  }

  // ── About modal ───────────────────────────────────────────────────────────
  const [aboutOpen, setAboutOpen] = useState(false)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast,        setToast]        = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  function showToast(msg: string) {
    clearTimeout(toastTimer.current)
    setToast(msg)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200)
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Sign in to view your profile</h1>
        <p className="text-sm text-gray-400 mb-8 max-w-xs">Access your saved events, preferences and account settings.</p>
        <button
          onClick={() => navigate('/login?redirect=/profile')}
          className="w-full max-w-xs h-12 bg-brand-600 text-white font-semibold rounded-xl text-sm"
        >
          Sign in
        </button>
      </div>
    )
  }

  // ─── Logged-in view ───────────────────────────────────────────────────────

  return (
    <>
      <Toast message={toast} visible={toastVisible} />

      <div className="bg-gray-50 min-h-[calc(100dvh-4rem)] pb-10 overflow-y-auto">

        {/* ── User header ──────────────────────────────────────────────── */}
        <div className="bg-white px-4 pt-8 pb-6 flex flex-col items-center border-b border-gray-100 mb-4">
          <div className="relative mb-3">
            <Avatar avatarUrl={user.avatarUrl} name={user.name} email={user.email} size={80} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">
            {user.name ?? user.email.split('@')[0]}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>

          <button
            onClick={openEdit}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit profile
          </button>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mx-4 mb-4">
          {[
            { value: favoritedIds.size, label: 'Events saved', icon: '❤️' },
            { value: citiesExplored,   label: 'Cities explored', icon: '🗺️' },
          ].map(({ value, label, icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">{icon}</span>
              <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
              <span className="text-xs text-gray-400 mt-1 font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Preferences ──────────────────────────────────────────────── */}
        <div className="mx-4 mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Preferences</p>
        </div>
        <Section>
          {/* Notifications */}
          <RowItem
            icon={
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            }
            label="Notifications"
            right={
              <Toggle
                on={notifOn}
                onToggle={() => {
                  const next = !notifOn
                  setNotifOn(next)
                  localStorage.setItem(NOTIF_KEY, String(next))
                }}
              />
            }
          />

          {/* Default city */}
          <div className="flex items-center gap-3.5 px-4 py-3 border-b border-gray-100">
            <span className="shrink-0 text-gray-400">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800">Default city</span>
            <select
              value={citySlug}
              onChange={(e) => setCity(e.target.value)}
              className="text-sm text-brand-600 font-semibold bg-transparent border-none outline-none cursor-pointer pr-1"
            >
              {allCities.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="flex items-center gap-3.5 px-4 py-3">
            <span className="shrink-0 text-gray-400">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800">Language</span>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                localStorage.setItem(LANG_KEY, e.target.value)
              }}
              className="text-sm text-brand-600 font-semibold bg-transparent border-none outline-none cursor-pointer pr-1"
            >
              <option value="en">English</option>
              <option value="it">Italiano</option>
            </select>
          </div>
        </Section>

        {/* ── App section ───────────────────────────────────────────────── */}
        <div className="mx-4 mb-1 mt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">App</p>
        </div>
        <Section>
          <RowItem
            icon={
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            }
            label="Suggest an event"
            right={
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            }
            onClick={() => { setSuggestName(''); setSuggestUrl(''); setSuggestSent(false); setSuggestOpen(true) }}
          />
          <RowItem
            icon={
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            }
            label="About ArtBeat"
            right={
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            }
            onClick={() => setAboutOpen(true)}
          />
          <RowItem
            icon={
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            }
            label="Privacy Policy"
            right={
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            }
            onClick={() => window.open('https://artbeat.app/privacy', '_blank')}
          />
        </Section>

        {/* ── Log out ───────────────────────────────────────────────────── */}
        <div className="mx-4 mt-2">
          <button
            onClick={handleLogout}
            className="w-full py-3.5 text-sm font-semibold text-red-500 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-red-50 transition-colors active:scale-[0.99]"
          >
            Log out
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 mt-5">ArtBeat v{APP_VERSION}</p>
      </div>

      {/* ── Edit profile bottom sheet ─────────────────────────────────── */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <form onSubmit={handleEditSave} className="space-y-4">
          {/* Avatar preview */}
          <div className="flex justify-center py-2">
            <Avatar
              avatarUrl={editAvatarUrl.trim() || null}
              name={editName.trim() || user.name}
              email={user.email}
              size={72}
            />
          </div>

          {editError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {editError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={user.email.split('@')[0]}
              className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Avatar URL</label>
            <input
              type="url"
              value={editAvatarUrl}
              onChange={(e) => setEditAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1.5">Leave empty to use initials.</p>
          </div>

          <button
            type="submit"
            disabled={editLoading}
            className="w-full h-12 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {editLoading ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </BottomSheet>

      {/* ── Suggest an event modal ────────────────────────────────────── */}
      <Modal open={suggestOpen} onClose={() => setSuggestOpen(false)} title="Suggest an event">
        {suggestSent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="text-5xl mb-3">🎉</span>
            <p className="font-semibold text-gray-800">Opening your mail app…</p>
            <p className="text-sm text-gray-400 mt-1">Thanks for suggesting an event!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              Know an event that should be on ArtBeat? Let us know and we'll add it.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event name</label>
              <input
                type="text"
                value={suggestName}
                onChange={(e) => setSuggestName(e.target.value)}
                placeholder="e.g. Klimt Experience Milano"
                className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Website or link</label>
              <input
                type="url"
                value={suggestUrl}
                onChange={(e) => setSuggestUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={handleSuggestSend}
              disabled={!suggestName.trim()}
              className="w-full h-12 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Send suggestion
            </button>
          </div>
        )}
      </Modal>

      {/* ── About modal ───────────────────────────────────────────────── */}
      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="About ArtBeat">
        <div className="flex flex-col items-center pt-2 pb-4 text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-brand-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">ArtBeat</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Version {APP_VERSION}</p>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
            Discover art events, exhibitions, performances, and openings happening near you.
            ArtBeat helps you explore the cultural scene of your city — right from your pocket.
          </p>
        </div>
      </Modal>
    </>
  )
}
