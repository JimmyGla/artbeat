import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from '../lib/supabase'

/**
 * Completes a native OAuth sign-in.
 *
 * The system browser returns to `io.artbeat.app://auth/callback?...`, which iOS
 * hands to the app as an `appUrlOpen` event. Supabase can send the result back
 * in one of two shapes depending on the flow type, so handle both:
 *
 *   • PKCE (the supabase-js v2 default) → `?code=...`, exchanged for a session
 *   • implicit                          → `#access_token=...&refresh_token=...`
 *
 * Mounted once, at the app root: the callback can arrive while any page is on
 * screen (or while none is, if the app was backgrounded), so a page-level
 * listener would miss it.
 */
export function useOAuthDeepLink(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handler = App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.includes('auth/callback')) return

      // Dismiss the system browser as soon as we have the callback, so the
      // user is not left staring at a blank Safari sheet.
      await Browser.close().catch(() => {})

      try {
        // `new URL` handles a custom scheme fine; the hash needs manual parsing.
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')
        const errorDescription =
          parsed.searchParams.get('error_description') ?? hash.get('error_description')

        if (errorDescription) {
          console.error('[oauth] provider returned an error:', errorDescription)
          navigate('/login', { replace: true })
          return
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
        } else {
          console.error('[oauth] callback carried neither a code nor tokens:', url)
          navigate('/login', { replace: true })
          return
        }

        // AuthContext's onAuthStateChange listener takes it from here.
        navigate('/', { replace: true })
      } catch (err) {
        console.error('[oauth] failed to complete sign-in:', err)
        navigate('/login', { replace: true })
      }
    })

    return () => { void handler.then((h) => h.remove()) }
  }, [navigate])
}
