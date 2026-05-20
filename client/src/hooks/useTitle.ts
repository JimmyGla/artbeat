import { useEffect } from 'react'

const APP_NAME = 'ArtBeat'

/**
 * Sets the document title, meta description, and canonical link for the
 * current page.  Call at the top of each page component.
 *
 * @param title       Page-specific title, e.g. "Discover".
 * @param description Optional meta description for the page.
 */
export function useTitle(title: string, description?: string): void {
  useEffect(() => {
    // ── <title> ────────────────────────────────────────────────────────
    document.title = `${title} · ${APP_NAME}`

    // ── <meta name="description"> ─────────────────────────────────────
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = description ?? `${title} — discover art events near you on ${APP_NAME}.`

    // ── <link rel="canonical"> ────────────────────────────────────────
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = window.location.origin + window.location.pathname
  }, [title, description])
}
