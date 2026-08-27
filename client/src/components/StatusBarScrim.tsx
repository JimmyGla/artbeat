import { useEffect, useState } from 'react'

interface Props {
  /** Background utility matching the page behind it, e.g. `bg-gray-50`. */
  className?: string
}

/**
 * Opaque strip covering the status-bar inset, for pages with a full-bleed hero.
 *
 * Those pages deliberately draw under the status bar (viewport-fit=cover), so
 * at rest this is transparent and the hero shows through.  Once the page
 * scrolls, body text would slide up into that strip and collide with the
 * clock — both are dark on light, so it reads as overlapping text rather than
 * a contrast problem.  Fading in a strip that matches the page background
 * hides whatever passes underneath.
 *
 * Scroll is observed in the capture phase so this works whether the document
 * or a nested container is the scroller (`scroll` does not bubble).
 */
export default function StatusBarScrim({ className = 'bg-white' }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = (e?: Event) => {
      const t = e?.target
      const y =
        t instanceof HTMLElement && t !== document.body && t !== document.documentElement
          ? t.scrollTop
          : window.scrollY
      setScrolled(y > 24)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [])

  return (
    <div
      aria-hidden="true"
      className={[
        'fixed top-0 left-0 right-0 z-20',
        'h-[env(safe-area-inset-top,0px)]',
        'transition-opacity duration-200',
        scrolled ? 'opacity-100' : 'opacity-0',
        className,
      ].join(' ')}
    />
  )
}
