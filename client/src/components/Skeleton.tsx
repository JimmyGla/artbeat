/**
 * Reusable skeleton loading components.
 * All use the same pulse animation via Tailwind's `animate-pulse`.
 */

// ─── Primitive ────────────────────────────────────────────────────────────────

interface SkeletonBaseProps {
  className?: string
  /** Override the default rounded-full with a custom radius class */
  rounded?: string
}

function Bone({ className = '', rounded = 'rounded-full' }: SkeletonBaseProps) {
  return <div className={`bg-gray-200 animate-pulse ${rounded} ${className}`} />
}

// ─── SkeletonText — a single line of text ─────────────────────────────────────

interface SkeletonTextProps {
  /** Tailwind width class, e.g. "w-3/4" or "w-24" */
  width?: string
  /** Tailwind height class; defaults to "h-3" */
  height?: string
  className?: string
}

export function SkeletonText({
  width   = 'w-full',
  height  = 'h-3',
  className = '',
}: SkeletonTextProps) {
  return <Bone className={`${height} ${width} ${className}`} />
}

// ─── SkeletonImage — image placeholder ───────────────────────────────────────

interface SkeletonImageProps {
  /** Tailwind aspect-ratio via paddingTop trick; defaults to 16:9 */
  aspectRatio?: string
  className?: string
}

export function SkeletonImage({
  aspectRatio = '56.25%',
  className   = '',
}: SkeletonImageProps) {
  return (
    <div
      className={`relative w-full bg-gray-200 animate-pulse ${className}`}
      style={{ paddingTop: aspectRatio }}
    />
  )
}

// ─── SkeletonCard — matches EventCard proportions ────────────────────────────

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl overflow-hidden border border-gray-100 ${className}`}>
      {/* Image area */}
      <SkeletonImage />

      {/* Content */}
      <div className="px-3.5 py-3 space-y-2">
        {/* Category pill */}
        <Bone className="h-5 w-20 rounded-full" />
        {/* Title — two lines */}
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-3/4" />
        {/* Venue */}
        <Bone className="h-3 w-28" />
        {/* Date */}
        <Bone className="h-3 w-32" />
      </div>
    </div>
  )
}

// ─── SkeletonVenueCard — matches VenueCard proportions ───────────────────────

export function SkeletonVenueCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl overflow-hidden border border-gray-100 flex ${className}`}>
      {/* Thumbnail */}
      <div className="w-24 shrink-0 bg-gray-200 animate-pulse min-h-[96px]" />

      {/* Content */}
      <div className="flex-1 px-3.5 py-3 space-y-2">
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-2/3" />
      </div>
    </div>
  )
}

// ─── SkeletonGrid — 2-column grid of SkeletonCards ───────────────────────────

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ─── SkeletonList — vertical list of SkeletonVenueCards ──────────────────────

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonVenueCard key={i} />
      ))}
    </div>
  )
}
