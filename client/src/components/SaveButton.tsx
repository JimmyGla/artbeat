import { useSaved, SaveTarget, SaveVerb, verbFor } from '../context/SavedContext'

/**
 * The single save control.
 *
 * Renders a heart for things that persist and a bookmark for things that
 * close, picking from the target itself. Because one component owns the
 * decision, no screen can accidentally offer both — which is the failure mode
 * two save actions usually produce.
 */

interface Props {
  target: SaveTarget
  /** Overlay sits on imagery (cards); plain sits on a surface (detail pages). */
  variant?: 'overlay' | 'plain'
  size?: 'sm' | 'md'
  onUnauthenticated?: () => void
  /** Fired after a successful toggle, with the NEW state — for toasts. */
  onToggled?: (nowSaved: boolean, verb: SaveVerb) => void
}

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true"
       fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.9}
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true"
       fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.9}
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)

export default function SaveButton({
  target,
  variant = 'overlay',
  size = 'md',
  onUnauthenticated,
  onToggled,
}: Props) {
  const { isSaved, toggleSave } = useSaved()

  const verb   = verbFor(target)
  const saved  = isSaved(target)
  const isHeart = verb === 'heart'

  // Wording differs because the verbs mean different things — "Save" would
  // flatten the distinction the whole design rests on.
  const label = saved
    ? (isHeart ? 'Remove from your places' : 'Remove from your list')
    : (isHeart ? 'Add to your places'      : 'Save to see before it closes')

  const box  = size === 'sm' ? 'w-8 h-8'  : 'w-10 h-10'
  const icon = size === 'sm' ? 'w-4 h-4'  : 'w-5 h-5'

  const skin = variant === 'overlay'
    ? 'bg-white/85 backdrop-blur-sm shadow-sm hover:bg-white'
    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'

  const tint = saved
    ? (isHeart ? 'text-rose-500' : 'text-brand-600')
    : 'text-gray-400 hover:text-gray-600'

  return (
    <button
      type="button"
      onClick={(e) => {
        // Cards are wrapped in links; saving must not navigate. Because this
        // stops propagation, a parent onClick would never fire — callers get
        // `onToggled` instead of wrapping this in a click handler.
        e.preventDefault()
        e.stopPropagation()
        const acted = toggleSave(target, onUnauthenticated)
        if (acted) onToggled?.(!saved, verb)
      }}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={[
        'shrink-0 flex items-center justify-center rounded-full',
        'transition-colors duration-150 active:scale-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        box, skin, tint,
      ].join(' ')}
    >
      <span className={icon}>
        {isHeart ? <HeartIcon filled={saved} /> : <BookmarkIcon filled={saved} />}
      </span>
    </button>
  )
}
