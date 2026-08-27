import { useEffect } from 'react'

const APP_NAME = 'ArtBeat'

/**
 * Sets the document title for the current page.  Call at the top of each
 * page component.
 *
 * This app is app-first: inside the Capacitor WebView the title is never
 * shown, so there is no canonical-link or meta-description handling here.
 * The title is still set so the web build keeps sane browser tabs.
 *
 * @param title       Page-specific title, e.g. "Discover".
 * @param _description Retained for call-site compatibility; unused.
 */
export function useTitle(title: string, _description?: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
