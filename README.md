# Adding a New City to ArtBeat

This guide explains how to add a new city to ArtBeat — from database record to live content.

---

## Overview

Cities in ArtBeat have two states:

- **Active** (`isActive: true`) — visible on the map, discoverable, and selectable by users.
- **Coming soon** (`isActive: false`) — shown greyed-out in the CitySelector modal but not navigable. Use this to signal intent before content is ready.

The typical workflow is:

1. Insert a "coming soon" city record.
2. Add venues and seed events.
3. Flip `isActive` to `true` when ready.

---

## Step 1 — Create the city record

Use the admin API. All admin endpoints require the `x-admin-secret` header whose value must match the `ADMIN_SECRET` environment variable set on the server.

```bash
curl -X POST https://your-api.example.com/api/admin/cities \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "name":      "Florence",
    "slug":      "florence",
    "country":   "Italy",
    "lat":       43.7696,
    "lng":       11.2558,
    "zoomLevel": 14,
    "isActive":  false
  }'
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✓ | Display name shown in the UI |
| `slug` | string | ✓ | URL-safe identifier, lowercase alphanumeric + hyphens, e.g. `"florence"` |
| `country` | string | ✓ | Country name shown under the city in the picker |
| `lat` | number | ✓ | Latitude of the map center |
| `lng` | number | ✓ | Longitude of the map center |
| `zoomLevel` | integer | — | Default Leaflet zoom (1–20). Defaults to `13`. Use `14` for compact historic centres. |
| `isActive` | boolean | — | Set `false` initially (default). Flip to `true` when ready. |

---

## Step 2 — Add venues

Insert venues via direct Prisma seed or a future `/api/admin/venues` endpoint. Each venue needs `cityId` pointing to the new city's database ID.

For a one-off seed, add a block like this to `server/prisma/seed.ts` (or a separate `seed-florence.ts` script):

```typescript
const florence = await prisma.city.findUnique({ where: { slug: 'florence' } })

await prisma.venue.create({
  data: {
    name:        'Galleria degli Uffizi',
    description: 'One of the oldest and most famous art museums in the world.',
    address:     'Piazzale degli Uffizi, 6, 50122 Firenze FI',
    lat:         43.7677,
    lng:         11.2553,
    type:        VenueType.MUSEUM,
    website:     'https://www.uffizi.it',
    cityId:      florence!.id,
  },
})
```

Run the seed:

```bash
cd server
npx prisma db seed
```

---

## Step 3 — Add events

Add events in the same seed file or via future admin endpoints. Events reference a `venueId` (from the venue created in Step 2) and a `categoryId`.

---

## Step 4 — Activate the city

Once content is ready, flip `isActive` to `true`:

```bash
curl -X PATCH https://your-api.example.com/api/admin/cities/florence \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{ "isActive": true }'
```

The city will immediately appear as a full option in the CitySelector modal across all three tabs (Map, Discover, Saved).

---

## Step 5 — (Optional) Update map defaults

If the new city should be the **default** when a user first opens the app, update the fallback slug in `client/src/context/CityContext.tsx`:

```typescript
const [citySlug, setCitySlug] = useState<string>(
  () => localStorage.getItem(STORAGE_KEY) ?? 'milan',  // ← change 'milan' to new slug
)
```

---

## Admin API reference

### `POST /api/admin/cities`
Create a new city. Returns the created city object (201).

### `PATCH /api/admin/cities/:slug`
Update any field of an existing city by slug. All fields optional. Returns the updated city.

**Updatable fields:** `name`, `country`, `lat`, `lng`, `zoomLevel`, `isActive`.

Both endpoints require `x-admin-secret` header.

---

## Environment variables

| Variable | Description |
|---|---|
| `ADMIN_SECRET` | Shared secret for admin API access. Set in `server/.env`. |

---

## Checklist

- [ ] City record created with `isActive: false`
- [ ] At least 3–5 venues added with correct coordinates
- [ ] At least 5 upcoming events seeded
- [ ] Map center (`lat`, `lng`, `zoomLevel`) verified by opening the map
- [ ] City flipped to `isActive: true`
- [ ] CitySelector shows the new city correctly in Map, Discover, and Saved tabs
