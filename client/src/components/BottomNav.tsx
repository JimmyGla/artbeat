import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

// ─── SVG icon primitives ─────────────────────────────────────────────────────

const MapIcon = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
    aria-hidden="true"
  >
    {filled ? (
      <path
        fillRule="evenodd"
        d="M8.161 2.58a1 1 0 0 1 .66-.074l5.995 1.498 3.846-1.282A1 1 0 0 1 20 3.75v14a1 1 0 0 1-.683.949l-4 1.333a1 1 0 0 1-.634 0L9.04 18.535l-3.723 1.241A1 1 0 0 1 4 18.826V4.75a1 1 0 0 1 .34-.753l3.82-1.417ZM9 5.429v12.733l6-1.715V3.714L9 5.43ZM7 5.97l-1 .37v12.294l1-.334V5.97Zm10-.256v12.295l1-.334V5.338l-1 .375Z"
        clipRule="evenodd"
      />
    ) : (
      <>
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
        <line x1="9" y1="3" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="21" />
      </>
    )}
  </svg>
)

const DiscoverIcon = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
    aria-hidden="true"
  >
    {filled ? (
      <path
        fillRule="evenodd"
        d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z"
        clipRule="evenodd"
      />
    ) : (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    )}
  </svg>
)

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const ProfileIcon = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
    aria-hidden="true"
  >
    {filled ? (
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
        clipRule="evenodd"
      />
    ) : (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    )}
  </svg>
)

// ─── Nav item config ──────────────────────────────────────────────────────────

interface NavItem {
  to:    string
  label: string
  icon:  (active: boolean) => JSX.Element
  end?:  boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Map',       icon: (a) => <MapIcon      filled={a} />, end: true },
  { to: '/discover',  label: 'Discover',  icon: (a) => <DiscoverIcon filled={a} /> },
  { to: '/favorites', label: 'Favorites', icon: (a) => <HeartIcon    filled={a} /> },
  { to: '/profile',   label: 'Profile',   icon: (a) => <ProfileIcon  filled={a} /> },
]

// ─── Component ────────────────────────────────────────────────────────────────
//
// Hide the nav when any page fires `window.dispatchEvent(new CustomEvent('nav:hide'))`
// and show it again on `nav:show`.  Pages with their own scroll containers
// (Discover, Favorites) dispatch these events from their scroll handlers.
// The nav re-appears automatically on route change.

const BottomNav = () => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const hide = () => setVisible(false)
    const show = () => setVisible(true)

    window.addEventListener('nav:hide', hide)
    window.addEventListener('nav:show', show)
    return () => {
      window.removeEventListener('nav:hide', hide)
      window.removeEventListener('nav:show', show)
    }
  }, [])

  return (
    <nav
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-white border-t border-gray-200',
        'flex items-stretch',
        'h-16',
        'pb-[env(safe-area-inset-bottom,0px)]',
        'shadow-[0_-1px_8px_rgba(0,0,0,0.06)]',
        'transition-transform duration-300 ease-in-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setVisible(true)} // always show on nav tap
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center justify-center gap-0.5',
              'min-h-[44px]', // WCAG 2.5.5 — minimum 44×44 px tap target
              'text-xs font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
              isActive
                ? 'text-brand-600'
                : 'text-gray-400 hover:text-gray-700 active:text-gray-900',
            ].join(' ')
          }
          aria-label={label}
        >
          {({ isActive }) => (
            <>
              {icon(isActive)}
              <span className="leading-none">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
