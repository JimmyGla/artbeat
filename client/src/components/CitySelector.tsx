import { useState, useCallback, useRef } from 'react'
import { useCity, CityData } from '../context/CityContext'
import { useFocusTrap }      from '../hooks/useFocusTrap'

// ─── Icons ────────────────────────────────────────────────────────────────────

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── City row ─────────────────────────────────────────────────────────────────

function CityRow({
  city,
  active,
  onClick,
}: {
  city:    CityData
  active:  boolean
  onClick: (c: CityData) => void
}) {
  const disabled = !city.isActive

  return (
    <button
      onClick={() => !disabled && onClick(city)}
      disabled={disabled}
      aria-pressed={active}
      aria-describedby={disabled ? `city-soon-${city.id}` : undefined}
      className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left transition-colors min-h-[44px] ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : active
            ? 'bg-brand-50'
            : 'hover:bg-gray-50'
      }`}
    >
      {/* City icon */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
        active ? 'bg-brand-100' : 'bg-gray-100'
      }`}>
        <PinIcon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${active ? 'text-brand-700' : 'text-gray-800'}`}>
          {city.name}
          {disabled && (
            <span id={`city-soon-${city.id}`} className="ml-1.5 text-xs font-normal text-gray-400">
              Coming soon
            </span>
          )}
        </p>
        <p className="text-xs text-gray-400">
          {city.country}
          {city.isActive && ` · ${city.venueCount} venue${city.venueCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Check mark for selected */}
      {active && <CheckIcon className="w-5 h-5 text-brand-600 shrink-0" />}
    </button>
  )
}

// ─── CitySelector ─────────────────────────────────────────────────────────────

interface CitySelectorProps {
  /** 'pill' = floating rounded button (maps); 'row' = inline text+chevron (headers) */
  variant?: 'pill' | 'row'
}

export default function CitySelector({ variant = 'pill' }: CitySelectorProps) {
  const { city, citySlug, allCities, setCity } = useCity()
  const [open, setOpen] = useState(false)

  // Focus trap & Escape key for the modal
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, open, () => setOpen(false))

  const handleSelect = useCallback((c: CityData) => {
    setCity(c.slug)
    setOpen(false)
  }, [setCity])

  // ── Trigger ───────────────────────────────────────────────────────────────

  const trigger =
    variant === 'row' ? (
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change city. Current: ${city?.name ?? 'Loading'}`}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-brand-600 transition-colors min-h-[44px] px-1"
      >
        <PinIcon className="w-4 h-4 text-brand-600 shrink-0" />
        {city?.name ?? '…'}
        <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change city. Current: ${city?.name ?? 'Loading'}`}
        className="flex items-center gap-1.5 bg-white rounded-full pl-3 pr-4 py-2 shadow-md text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 transition-all min-h-[44px]"
      >
        <PinIcon className="w-4 h-4 text-brand-600 shrink-0" />
        {city?.name ?? '…'}
        <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
      </button>
    )

  // ── City groups ───────────────────────────────────────────────────────────

  const activeCities   = allCities.filter((c) => c.isActive)
  const inactiveCities = allCities.filter((c) => !c.isActive)

  // ── Modal ─────────────────────────────────────────────────────────────────

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-[2000] bg-black/50 flex items-end"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Select city"
            className="w-full bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900" id="city-selector-title">
                Select city
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close city selector"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <CloseIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Active cities */}
            <div role="list" aria-label="Available cities">
              {activeCities.map((c) => (
                <div key={c.id} role="listitem">
                  <CityRow city={c} active={c.slug === citySlug} onClick={handleSelect} />
                </div>
              ))}
            </div>

            {/* Coming soon section */}
            {inactiveCities.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2 px-1">
                  Coming soon
                </p>
                <div role="list" aria-label="Coming soon cities">
                  {inactiveCities.map((c) => (
                    <div key={c.id} role="listitem">
                      <CityRow city={c} active={false} onClick={handleSelect} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
