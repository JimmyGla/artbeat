import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

/**
 * Google sign-in.
 *
 * The previous implementation did `window.location.href = API + '/api/auth/google'`,
 * which cannot work in the native app for three independent reasons:
 *
 *   1. it navigates the WebView away from `capacitor://localhost`, discarding
 *      the running app;
 *   2. the server sent Supabase a `redirectTo` of `http://localhost:5173`
 *      (the Vite dev server), which on a phone is the phone itself;
 *   3. Google refuses OAuth inside embedded WebViews entirely — it answers
 *      `disallowed_useragent` — so the flow has to run in the system browser
 *      no matter what the redirect says.
 *
 * So: open the provider URL in the system browser, and come back via a custom
 * URL scheme that iOS routes to the app. The deep link is handled centrally in
 * `useOAuthDeepLink`, because the return trip can land while any page is
 * mounted.
 */

/** Must match CFBundleURLTypes in Info.plist and the Supabase redirect allow-list. */
export const OAUTH_REDIRECT = 'io.artbeat.app://auth/callback'

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const native = Capacitor.isNativePlatform()

  // On web, keep the ordinary redirect flow: same-origin, so `window.location`
  // is correct there and Supabase can pick the session out of the URL.
  const redirectTo = native ? OAUTH_REDIRECT : `${window.location.origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // Native: we open the URL ourselves in the system browser rather than
      // letting the SDK replace the WebView's location.
      skipBrowserRedirect: native,
    },
  })

  if (error) return { error: error.message }
  if (!data.url) return { error: 'No authorization URL returned' }

  if (native) {
    // Fullscreen, not 'popover': on a compact-width device (every iPhone) the
    // popover style presents as a sheet that can come up blank, and an auth
    // flow wants the whole screen anyway so the user can see the URL bar.
    await Browser.open({ url: data.url, presentationStyle: 'fullscreen' })
  } else {
    window.location.href = data.url
  }
  return {}
}
