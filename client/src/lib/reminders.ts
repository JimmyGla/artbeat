import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

/**
 * Closing reminders, scheduled on the device.
 *
 * A bookmark is a promise to go before it closes, and the closing date is known
 * the moment it's made. So there is nothing to push: the phone schedules the
 * notification itself. That means no APNs key, no Apple Developer paid account,
 * no server cron, and no dependency on the API being up — the reminder fires
 * from the phone's own queue even offline. Venue alerts are the opposite case
 * (the app cannot learn about a new exhibition while closed) and do need push.
 *
 * The device queue is treated as a cache, never as the source of truth: the
 * server's bookmark list is authoritative, and `syncReminders` rebuilds the
 * queue to match it. That is what keeps a bookmark removed on another device
 * from still firing here.
 */

/** Days before closing that the reminder fires. */
const LEAD_DAYS = 3

/** Local hour of day. Midnight would technically work and be user-hostile. */
const FIRE_HOUR = 10

/** Notifications live in this range so we can clear ours without touching others'. */
const ID_SPACE = 1_000_000

export interface ReminderInput {
  exhibitionId: string
  title: string
  venueName: string | null
  /** DATE from the API: an ISO string pinned to UTC midnight. */
  endsOn: string | null
  /** User override; not yet surfaced in the UI, honoured here so it works when it is. */
  remindAt?: string | null
}

/** Local notification ids must be numbers, so derive a stable one from the uuid. */
export function notificationId(exhibitionId: string): number {
  let h = 0
  for (let i = 0; i < exhibitionId.length; i++) {
    h = (h * 31 + exhibitionId.charCodeAt(i)) | 0
  }
  return Math.abs(h) % ID_SPACE
}

/**
 * When to fire, or null if there is no useful moment left.
 *
 * `endsOn` is a DATE, serialised as UTC midnight. Reading it with `new Date()`
 * and using the local getters would shift the day backwards for anyone west of
 * UTC — the same off-by-one that already bit the scraper's date parsing. So the
 * calendar parts are read in UTC and the reminder is then built in *local* time:
 * a show closing on the 15th closes on the 15th wherever you are.
 */
export function fireDateFor(input: ReminderInput, now: Date = new Date()): Date | null {
  if (input.remindAt) {
    const explicit = new Date(input.remindAt)
    return explicit > now ? explicit : null
  }
  if (!input.endsOn) return null

  const end = new Date(input.endsOn)
  if (Number.isNaN(end.getTime())) return null

  const target = new Date(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate() - LEAD_DAYS,
    FIRE_HOUR, 0, 0, 0,
  )

  // Bookmarked inside the lead window, or on the day: still worth one warning,
  // but only if the show has not already closed.
  if (target <= now) {
    const lastDay = new Date(
      end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999,
    )
    if (lastDay <= now) return null

    const soon = new Date(now.getTime() + 60 * 60 * 1000)
    return soon < lastDay ? soon : null
  }

  return target
}

/** Copy that says what to do, not what the system did. */
export function reminderBody(input: ReminderInput, fireDate: Date): string {
  const end = input.endsOn ? new Date(input.endsOn) : null
  const days = end
    ? Math.round(
        (Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
          Date.UTC(fireDate.getFullYear(), fireDate.getMonth(), fireDate.getDate())) /
          86_400_000,
      )
    : 0

  const when =
    days <= 0 ? 'Last day' : days === 1 ? 'Closes tomorrow' : `Closes in ${days} days`
  return input.venueName ? `${when} at ${input.venueName}.` : `${when}.`
}

/** Local notifications are a native capability; the browser build no-ops. */
function available(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Ask for permission, returning whether we have it.
 *
 * Called when the user first bookmarks something rather than at launch: asked
 * cold on first open the prompt has no context and gets denied, and iOS only
 * ever asks once.
 */
export async function ensurePermission(): Promise<boolean> {
  if (!available()) return false
  try {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true
    if (current.display === 'denied') return false
    const asked = await LocalNotifications.requestPermissions()
    return asked.display === 'granted'
  } catch (err) {
    console.warn('[reminders] permission check failed', err)
    return false
  }
}

/** Drop a single reminder — the bookmark is gone, so the promise is void. */
export async function cancelReminder(exhibitionId: string): Promise<void> {
  if (!available()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(exhibitionId) }] })
  } catch (err) {
    console.warn('[reminders] cancel failed', err)
  }
}

/**
 * Make the device queue match the given bookmarks exactly.
 *
 * Rebuild rather than diff: scheduling is idempotent on id, so re-scheduling
 * the survivors is cheap, and cancelling everything we own first is the only
 * way to clear reminders for bookmarks removed elsewhere. Only our own id space
 * is touched.
 */
export async function syncReminders(
  inputs: ReminderInput[],
  { prompt = false }: { prompt?: boolean } = {},
): Promise<number> {
  if (!available()) return 0

  // The sync runs on every app open, and iOS only ever shows the prompt once —
  // spending it there, before the user has bookmarked anything, asks for
  // permission to send reminders they have not asked for. So only an actual
  // bookmark may prompt; a routine sync proceeds solely if already granted.
  const granted = prompt
    ? await ensurePermission()
    : (await LocalNotifications.checkPermissions().catch(() => null))?.display === 'granted'
  if (!granted) return 0

  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.id < ID_SPACE)
    if (ours.length) {
      await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
    }

    const now = new Date()
    const due = inputs
      .map((input) => ({ input, at: fireDateFor(input, now) }))
      .filter((x): x is { input: ReminderInput; at: Date } => x.at !== null)

    if (!due.length) return 0

    await LocalNotifications.schedule({
      notifications: due.map(({ input, at }) => ({
        id:     notificationId(input.exhibitionId),
        title:  input.title,
        body:   reminderBody(input, at),
        schedule: { at, allowWhileIdle: true },
        // Read by the tap handler to open the right exhibition.
        extra: { exhibitionId: input.exhibitionId },
      })),
    })

    return due.length
  } catch (err) {
    console.warn('[reminders] sync failed', err)
    return 0
  }
}

/** How many reminders are actually sitting in the OS queue. */
export async function pendingCount(): Promise<number> {
  if (!available()) return 0
  try {
    const pending = await LocalNotifications.getPending()
    return pending.notifications.filter((n) => n.id < ID_SPACE).length
  } catch {
    return 0
  }
}

/**
 * Route a tapped notification to its exhibition.
 *
 * Returns the listener handle so callers can detach; navigation is injected
 * because this module must not import the router.
 */
export async function onReminderTapped(navigate: (path: string) => void) {
  if (!available()) return null
  try {
    return await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const id = action.notification.extra?.exhibitionId
      if (typeof id === 'string' && id) navigate(`/exhibition/${id}`)
    })
  } catch (err) {
    console.warn('[reminders] listener failed', err)
    return null
  }
}
