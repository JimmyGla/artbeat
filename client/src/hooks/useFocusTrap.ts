import { useEffect, RefObject } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps keyboard focus inside `containerRef` while `active` is true.
 * Also closes the modal on Escape if `onClose` is provided.
 *
 * @param containerRef  Ref to the modal/overlay container element.
 * @param active        Whether the trap is currently active.
 * @param onClose       Called when the user presses Escape.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose?: () => void,
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    // Move focus into the modal
    first?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || focusable.length === 0) return

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef, onClose])
}
