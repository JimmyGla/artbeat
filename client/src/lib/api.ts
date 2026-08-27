import { Capacitor } from '@capacitor/core'

const devUrl  = import.meta.env.VITE_API_URL      || 'http://localhost:3001'
const prodUrl = import.meta.env.VITE_PROD_API_URL || devUrl

export const API_BASE: string = Capacitor.isNativePlatform() ? prodUrl : devUrl

/**
 * Public web origin for shareable links.
 *
 * Sharing used to send `window.location.href`, which inside the Capacitor
 * WebView is `capacitor://localhost/...` — a dead link for whoever receives it.
 * Set VITE_SHARE_BASE_URL once the web build is deployed.
 *
 * Empty is handled deliberately rather than producing a broken link: callers
 * fall back to sharing the source page instead. See `shareTarget`.
 */
export const SHARE_BASE: string = (import.meta.env.VITE_SHARE_BASE_URL as string | undefined) ?? ''

/**
 * What to actually share for an exhibition.
 *
 * Prefers our own canonical URL; with no public origin configured it shares the
 * source listing, which at least resolves. Never shares a capacitor:// URL.
 */
export function shareTarget(id: string, fallbackUrl?: string | null): string | null {
  if (SHARE_BASE) return `${SHARE_BASE.replace(/\/$/, '')}/exhibition/${id}`
  return fallbackUrl ?? null
}

/**
 * A connection-failure message that says where we were trying to reach.
 *
 * On a dev build the API base is the machine's LAN address, baked in at build
 * time. DHCP reassigns that address, and when it does every request fails with
 * a generic "check your connection" — which reads as a bug in the app and has
 * cost real debugging time more than once. Naming the host turns that into an
 * immediate diagnosis.
 *
 * Only private addresses are named, so this never leaks a production hostname
 * into a user-facing message: for a deployed API the message stays generic.
 */
export function connectionError(what: string): string {
  const isPrivateHost = /\/\/(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost)/.test(API_BASE)
  return isPrivateHost
    ? `Failed to load ${what}. No answer from ${API_BASE.replace(/^https?:\/\//, '')} — the dev server's IP may have changed; rebuild with npm run build:device.`
    : `Failed to load ${what}. Check your connection.`
}
