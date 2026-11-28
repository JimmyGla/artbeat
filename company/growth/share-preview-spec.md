# Share-link preview spec (handoff to product-manager, feeds R8)

**Audience:** anyone receiving a show link in WhatsApp, Telegram, Instagram DMs/stories. This is the main growth loop.
**Message:** the preview alone must say what, where, when, and that it's ArtBeat.
**Where it goes:** product-manager turns this into acceptance criteria for R8 (and R15 for search).
**Success signal (analyst):** share-button taps (if telemetry has an event; if not, add a scalar-only `share` event, within the telemetry privacy boundary); visits to `/e/:id` from first-time users; first-time visitors per share.

## Requirements for `/e/:id` and `/v/:id`

Important: link previews are read by crawlers that do not run JavaScript. A client-rendered SPA on Cloudflare Pages will show a generic preview unless the OG tags are in the HTML the crawler fetches. R8 must decide how (for example a Cloudflare Pages Function that injects tags per show, or prerendered pages). Verify with a real paste in WhatsApp and Telegram, not just a tag check.

- `og:title`: `{Show title} - {Venue}` (max ~60 chars)
- `og:description`: `{dates, e.g. fino al 12 gen} · {free / €price if known} · {neighbourhood}` (max ~110 chars). If price or hours are unknown, omit them; never guess.
- `og:image`: show image if we have one with a clear right to display it; otherwise a generated card (1200x630) with title, venue, dates on a plain background. Check image licensing with `legal-privacy` before hotlinking venue images.
- `og:url`, `og:site_name` = ArtBeat, `og:locale` it_IT with en_US alternate; `twitter:card` summary_large_image.
- Language: Italian default; English if the link carries `?lang=en`.
- Share button uses the Web Share API with text: `{title} @ {venue}, fino al {date}: {url}`, falling back to copy-link.
- Ended shows still open with an "ended" notice, not a 404.
- Links carry no personal data; optional `?ref=` only for campaign tracking.

## Draft share text (IT / EN)

IT: "{Titolo} da {Sede}, fino al {data}. Ci andiamo? {URL}"
EN: "{Title} at {Venue}, until {date}. Want to go? {URL}"
