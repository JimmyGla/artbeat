import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onReminderTapped } from '../lib/reminders'

/**
 * Opens the exhibition behind a tapped closing reminder.
 *
 * Mounted once at the app root, for the same reason as the OAuth listener: the
 * tap usually arrives with the app cold-started or backgrounded, so a listener
 * living on any single page would not exist yet when it fires.
 *
 * A reminder that opens the app to wherever it was left is a dead end — the
 * user has three days to act and no way back to the show being warned about.
 */
export function useReminderTaps(): void {
  const navigate = useNavigate()

  useEffect(() => {
    let handle: { remove: () => void } | null = null
    let cancelled = false

    onReminderTapped((path) => navigate(path)).then((h) => {
      // The listener resolves asynchronously, so unmount can beat it here.
      if (cancelled) h?.remove()
      else handle = h
    })

    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [navigate])
}
