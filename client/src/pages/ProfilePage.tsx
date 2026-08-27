import { useState, useRef, useEffect, FormEvent } from 'react'
import { useNavigate }   from 'react-router-dom'
import StatusBarScrim   from '../components/StatusBarScrim'
import { useAuth }       from '../context/AuthContext'
import { useSaved }       from '../context/SavedContext'
import { useCity }       from '../context/CityContext'
import { API_BASE }      from '../lib/api'
import { Capacitor }      from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { ensurePermission, syncReminders, pendingCount } from '../lib/reminders'
import { track, hasOptedOut, setOptedOut } from '../lib/telemetry'

// ─── Constants ────────────────────────────────────────────────────────────────

const API         = API_BASE
const APP_VERSION = '0.1.0'

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
  const { counts }                       = useSaved()
  const { allCities, citySlug, setCity } = useCity()

  // ── Closing reminders ─────────────────────────────────────────────────────
  //
  // The switch reflects the OS permission, not a preference of our own: the
  // system setting is the real state, and storing a second copy would let the
  // two disagree after a change in Settings. `blocked` is the denied case — iOS
  // will not prompt twice, so the row explains where to fix it instead of
  // offering a toggle that silently does nothing.
  const [remindersOn,      setRemindersOn]      = useState(false)
  const [remindersBlocked, setRemindersBlocked] = useState(false)
  const [remindersCount,   setRemindersCount]   = useState(0)

  // ── Diagnostics opt-out ───────────────────────────────────────────────────
  //
  // Stored on the device, checked before anything is sent. Presented as a real
  // choice rather than buried, because the honest basis for collecting this at
  // all is that it is anonymous, minimal, and refusable.
  const [diagnosticsOn, setDiagnosticsOn] = useState(!hasOptedOut())

  const toggleDiagnostics = () => {
    const next = !diagnosticsOn
    setDiagnosticsOn(next)
    setOptedOut(!next)
    showToast(next ? 'Diagnostics on' : 'Diagnostics off')
  }
  const remindersSupported = Capacitor.isNativePlatform()

  useEffect(() => {
    if (!remindersSupported) return
    LocalNotifications.checkPermissions()
      .then(async ({ display }) => {
        setRemindersOn(display === 'granted')
        setRemindersBlocked(display === 'denied')
        if (display === 'granted') setRemindersCount(await pendingCount())
      })
      .catch(() => setRemindersBlocked(true))
  }, [remindersSupported])

  const handleRemindersToggle = async () => {
    if (remindersOn) {
      // We cannot revoke an OS permission, so "off" means clear the schedule
      // and point at the only place that can actually turn it off.
      await syncReminders([])
      setRemindersOn(false)
      setRemindersCount(0)
      showToast('Reminders cleared. Turn off notifications in Settings to stop them for good.')
      return
    }

    const granted = await ensurePermission()
    if (!granted) {
      setRemindersBlocked(true)
      showToast('Notifications are off for ArtBeat. Enable them in Settings.')
      return
    }

    setRemindersOn(true)
    // Existing bookmarks have no reminders yet — this is the moment they get them.
    try {
      const r = await authFetch(`${API_BASE}/api/saved/reminders`)
      if (!r.ok) throw new Error(String(r.status))
      const { reminders } = await r.json()
      const n = await syncReminders(reminders, { prompt: true })
      setRemindersCount(n)
      track('reminders_enabled', { scheduled: n })
      showToast(n === 1 ? '1 reminder scheduled' : `${n} reminders scheduled`)
    } catch (err) {
      console.warn('[profile] could not schedule reminders', err)
      showToast('Reminders are on, but the list could not be loaded.')
    }
  }

  // ── Preferences (localStorage) ────────────────────────────────────────────

  // Saved counts come from SavedContext, which already tracks them for the
  // cards — no extra request needed here.

  // ── Edit profile sheet ────────────────────────────────────────────────────
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError,   setDeleteError]   = useState('')
  const [deleting,      setDeleting]      = useState(false)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      const r = await authFetch(`${API}/api/users/me`, { method: 'DELETE' })
      if (!r.ok && r.status !== 204) {
        // The server refuses rather than half-deleting, so its message is
        // accurate about what did or did not happen.
        const body = await r.json().catch(() => null)
        setDeleteError(body?.error ?? 'Could not delete your account. Please try again.')
        return
      }
      // Clear the local session too, or the app keeps a token for an account
      // that no longer exists.
      await logout()
      navigate('/', { replace: true })
    } catch {
      setDeleteError('Could not reach the server. Nothing was deleted.')
    } finally {
      setDeleting(false)
    }
  }

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
      `Exhibition or event name: ${suggestName}\nLink / details: ${suggestUrl}\n\nSuggested via ArtBeat v${APP_VERSION}`,
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
        <p className="text-sm text-gray-400 mb-8 max-w-xs">Access your saved places, your list, and account settings.</p>
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

      <StatusBarScrim className="bg-white" />

      <div className="bg-gray-50 min-h-dvh overflow-y-auto pb-[calc(var(--nav-h)+1.5rem)]">

        {/* ── User header ──────────────────────────────────────────────── */}
        <div className="bg-white px-4 pb-6 flex flex-col items-center border-b border-gray-100 mb-4" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}>
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
            { value: counts.places, label: 'Places',  icon: '❤️' },
            { value: counts.toSee,  label: 'To see',  icon: '🔖' },
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
          {/* Default city — the only real preference. The notifications and
              language rows were removed: both wrote localStorage that nothing
              read, so they promised behaviour the app does not have. */}
          <div className="flex items-center gap-3.5 px-4 py-3">
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

          {/* Closing reminders. This is a real toggle, unlike the notifications
              switch that used to sit here — it drives an actual OS permission
              and an actual schedule.

              It exists because permission is otherwise only ever requested when
              bookmarking something new, so anyone who already had bookmarks
              would never be asked and would silently never get a reminder. iOS
              also only shows its prompt once, so there has to be one honest
              place to ask. */}
          {remindersSupported && (
            <div className="flex items-center gap-3.5 px-4 py-3 border-t border-gray-100">
              <span className="shrink-0 text-gray-400">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-800">Closing reminders</span>
                <span className="block text-xs text-gray-500">
                  {remindersBlocked
                    ? 'Turn on notifications for ArtBeat in Settings'
                    : remindersOn
                      ? remindersCount === 1
                        ? '1 reminder scheduled'
                        : `${remindersCount} reminders scheduled`
                      : 'A nudge three days before a saved show closes'}
                </span>
              </span>
              <button
                role="switch"
                aria-checked={remindersOn}
                aria-label="Closing reminders"
                disabled={remindersBlocked}
                onClick={handleRemindersToggle}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                  remindersBlocked ? 'bg-gray-200 opacity-50' : remindersOn ? 'bg-brand-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    remindersOn ? 'left-[1.375rem]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Diagnostics. Named for what it is; "Share analytics" would
              overstate it and "Improve ArtBeat" would understate it. */}
          <div className="flex items-center gap-3.5 px-4 py-3 border-t border-gray-100">
            <span className="shrink-0 text-gray-400">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-800">Send diagnostics</span>
              <span className="block text-xs text-gray-500">
                Anonymous crash reports and usage counts. Never your account, searches, or location.
              </span>
            </span>
            <button
              role="switch"
              aria-checked={diagnosticsOn}
              aria-label="Send diagnostics"
              onClick={toggleDiagnostics}
              className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                diagnosticsOn ? 'bg-brand-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  diagnosticsOn ? 'left-[1.375rem]' : 'left-0.5'
                }`}
              />
            </button>
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

        {/* ── Delete account ────────────────────────────────────────────────
            Required: Apple rejects apps that create accounts without an
            in-app way to delete them. Kept visually quiet and behind a typed
            confirmation, because it is irreversible. */}
        <div className="mx-4 mt-3">
          <button
            onClick={() => { setDeleteConfirm(''); setDeleteOpen(true) }}
            className="w-full py-3 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
          >
            Delete account
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 mt-5">ArtBeat v{APP_VERSION}</p>
      </div>

      {/* ── Delete account ───────────────────────────────────────────── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            This removes your account, the places you follow and your list. It
            cannot be undone.
          </p>
          <p className="text-sm text-gray-500">
            Type <span className="font-semibold text-gray-800">delete</span> to confirm.
          </p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="delete"
            aria-label="Type delete to confirm"
            className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm.trim().toLowerCase() !== 'delete' || deleting}
            className="w-full h-12 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
          <button
            onClick={() => setDeleteOpen(false)}
            className="w-full h-12 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Keep my account
          </button>
        </div>
      </Modal>

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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Exhibition or event name</label>
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
            Discover exhibitions, performances, talks and openings happening near you.
            ArtBeat helps you explore the cultural scene of your city — right from your pocket.
          </p>
        </div>
      </Modal>
    </>
  )
}
