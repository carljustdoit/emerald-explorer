# Emerald Explorer — Data Pipeline Architecture

Use this skill before touching any scraper, connector, enrichment logic, weather/snow/water service, or the feed schema. This documents every source, key principle, and architectural decision.

---

## Pipeline Overview

```
Admin triggers scrape (/api/admin/scrape)
        │
        ▼
orchestrator.ts — Phase 1: scrapeAllEventSources()
  └── Runs ALL enabled connectors in parallel
  └── Each connector returns RawScrapedEvent[]
        │
        ▼
orchestrator.ts — Phase 2: validateAndDeduplicate()
  └── Validates each event via RawScrapedEventSchema (Zod)
  └── Drops events with title < 3 chars
  └── Deduplicates: source + title + normalized_date + time
        │
        ▼
gemini_tagger.ts — Enrichment
  └── Date parsing → ISO format
  └── Location resolution (3-level fallback)
  └── Geocoding via KNOWN_VENUES or coordinates
  └── Vibe tag generation (20 categories)
  └── Kid-friendly estimation
  └── Second deduplication pass (title + date + source + location)
        │
        ▼
Zod greenlight validation (EmeraldEventSchema)
        │
        ▼
public/seattle_master_feed.json  (+ optional S3 upload)
        │
        ▼
GET /api/events  (5-min server-side feed cache)
```

---

## Connector Registry

All connectors implement `DataConnector` interface (`connectors/types.ts`):
```typescript
interface DataConnector {
  name: string;
  sourceUrl: string;
  enabled: boolean;
  type: 'http' | 'playwright';
  category: string;
  scrape(): Promise<RawScrapedEvent[]>;
}
```

Connectors are registered as singletons in `connectors/index.ts` via `connectorRegistry`.

---

## Event Source Connectors (11 total)

### HTTP connectors (no browser needed, fast)

| Connector | Source URL | Notes |
|---|---|---|
| **Events12** | `https://www.events12.com/seattle/` | HTML scrape with Cheerio; handles date ranges ("Mar 5-8" → multiple events); sports tables + concert tables |
| **19hz** | `https://19hz.info/eventlisting_Seattle.php` | 6-column table; date format "Tue: Mar 17 (6:30pm-9pm)"; splits title/venue on `@`; appends warning for social media links |
| **Ticketmaster** | `https://app.ticketmaster.com/discovery/v2/events.json` | Requires `TICKETMASTER_API_KEY`; 3 pages × 200 events = 600 max; Seattle + WA filter; prefers 16:9 images >600px wide |
| **StubHub** | `https://api.stubhub.com/sellers/search/events/v3` | Requires `STUBHUB_CLIENT_ID` + `STUBHUB_CLIENT_SECRET`; OAuth2 client-credentials flow; 50 events per call |

### Playwright connectors (headless Chromium, slower, more robust)

| Connector | Source URL | Notes |
|---|---|---|
| **Seattle Symphony** | `https://www.seattlesymphony.org/en/concerttickets/calendar` | Up to 5 pages; deep-scrapes detail pages with 1–3s jittered delay; caches detail results in-memory Map; hard-coded venue "Benaroya Hall" |
| **Seattle Opera** | `https://www.seattleopera.org/calendar/` | Selects `.calendar-list-events-item` with `data-*` attributes; falls back to "McCaw Hall, Seattle Center" |
| **Jazz Alley** | `https://www.jazzalley.com/www-home/calendar.jsp` | Deep-scrapes artist detail pages; parses `<select>` sessions; splits on `@` for date/time; price via `$XX.XX` regex |
| **UW Arts** | `https://art.washington.edu/calendar` | Generic selectors (`.event-item`, `article`, `.event-listing`); falls back to "Various UW Venues" |
| **UW Huskies** | `https://gohuskies.com/calendar/print/month/...` | Static date range URL (update monthly!); regex on body text for sport keywords; only imports **home** games ("vs"); venue map by sport |
| **Fever** | `https://feverup.com/en/seattle/candlelight` | Two-phase: index scrapes `/m/` links → detail pages; prefers JSON-LD (`application/ld+json`); DOM fallback; sessions = all dates × all times cross-product |

### Venue sport mapping (UW Huskies)
```
Football    → Husky Stadium
Basketball  → Alaska Airlines Arena
Baseball    → Husky Ballpark
Soccer      → Husky Soccer Stadium
```

---

## Enrichment — gemini_tagger.ts

### Location Resolution (3-level fallback)
1. **Exact coords from scraper** — if connector provides `eventLat`/`eventLon`
2. **KNOWN_VENUES map** — 150+ Seattle venues with precise lat/lon (5th Ave Theatre, Paramount, Neumos, Crocodile, Climate Pledge Arena, T-Mobile Park, Lumen Field, Husky Stadium, neighborhoods, regional cities, etc.)
3. **DOMAIN_VENUES map** — domain-based fallback (e.g. seattlesymphony.org → Benaroya Hall coords)

### Vibe Tags (20 categories)
`tech`, `bass`, `house`, `techno`, `trance`, `electronic`, `music`, `food`, `outdoor`, `sports`, `art`, `drinks`, `market`, `education`, `nightlife`, `family`, `fitness`, `wellness`, `community`, `performance`

Tags are keyword-matched from title + description. An event can have multiple tags.

### Kid-Friendly Estimation
- **Adult indicators** (sets `is_kid_friendly: false`): "21+", "nightclub", "bar", "brewery", "cocktail", "adult"
- **Family indicators** (sets `is_kid_friendly: true`): "all ages", "zoo", "museum", "park", "kids", "family", "children"

### Date Parsing (complex — be careful)
Handles: `"March 15"`, `"3/15"`, `"March 15, 2026"`, weekday names. Adds 7 days if parsed date is already past. Output is always ISO 8601.

---

## Validation Schema — schema.ts (Zod)

### RawScrapedEvent (ingestion input)
- `title`: min 3 chars
- `date`, `time`: optional strings
- `url`: valid URL if present
- All other fields optional

### EmeraldEvent (enriched output, what goes in the feed)
```typescript
{
  id: string            // generated UUID
  source: string        // connector name
  title: string
  description?: string
  start_time: string    // ISO 8601
  end_time?: string
  price?: string
  sessions?: Session[]
  is_kid_friendly: boolean
  vibe_tags: string[]
  location: {
    name: string
    lat?: number
    lon?: number
    address?: string
  }
  url?: string
  image?: string
  ticket_url?: string
}
```

### EmeraldFeed (the JSON file)
```typescript
{ metadata: { generated_at, event_count, sources }, events: EmeraldEvent[] }
```

---

## Deduplication Rules

**Phase 1** (orchestrator, before enrichment):
- Key: `source + title + normalize(date) + time`
- `normalizeDate` strips time patterns and trims whitespace

**Phase 2** (gemini_tagger, after enrichment):
- Key: `title + date + source + location.name + location.address`

Both passes must pass for an event to survive. If you add a new connector, make sure its `source` name is unique.

---

## Environmental / Sports Data

Separate from events — served from `/api/sports-data` and consumed by `UnifiedInsightCard` on Home.

### SportsDataService.ts — Architecture
- **Cache**: 15-minute TTL, in-memory. `forceReload` param bypasses it.
- **Fetches in parallel**: snow + weather + mountain forecast + water data
- **Returns**: Unified `SportsData` object with `today`, `tomorrow`, `weekend`, `thisWeek`, `weekly_forecast[]`

### Snow Data — SnowScraper.ts

Three resorts scraped directly from their APIs (not web pages):

| Resort | API Endpoint | Key Fields |
|---|---|---|
| **Snoqualmie** | `https://www.summitatsnoqualmie.com/api/reportpal?resortName=ss&useReportPal=true` | `newSnow24h`, `baseDepth`, `midDepth` (Alpental Mid), `peakDepth` (Alpental Top) |
| **Stevens Pass** | `https://www.stevenspass.com/api/PageApi/GetWeatherDataForHeader` | `baseDepth`; `peakDepth = base × 1.2` |
| **Crystal Mountain** | `https://mtnpowder.com/feed/v3.json?bearer_token=...&resortId[]=80` | `baseDepth`; `midDepth = base × 1.15`; `peakDepth = base × 1.4` |

All have **5-second fetch timeouts** and hardcoded **fallback values** if the API is down:
- Snoqualmie: base 57, mid 65, peak 80
- Stevens: base 95, mid 105, peak 120
- Crystal: base 78, mid 95, peak 115

### Weather Data

| Source | API | What we get |
|---|---|---|
| **NWS Seattle** | `https://api.weather.gov/gridpoints/SEW/125,68/forecast` | City weather — temp high/low, shortForecast, precipitation |
| **NWS Mountain** | `https://api.weather.gov/gridpoints/PDT/63,197/forecast` | Mountain forecast — parsed for snow accumulation via regex |

### Water Data

| Source | API | What we get |
|---|---|---|
| **Lake Union temp** | USGS water services (`siteNo=12120000`) | Current water temperature |
| **Cedar River flow** | USGS water services (`siteNo=12119000`) | River flow rate |
| **Tides (Seattle)** | NOAA tides/currents API | High/low tide times + heights |
| **King County buoy** | `https://data.kingcounty.gov/resource/kngk-29j2.json` (station 0540) | Lake water temp |
| **Wind (West Point)** | NDBC RSS feed (`WPOW1`) | Wind speed mph |
| **Puget Sound temp** | NOAA API (station 9447130) | Puget Sound water temperature |

### Wave Condition Logic
Derived from max wind speed — not from a wave API:
```
wind > 15 mph  → "Choppy"
wind > 8 mph   → "Light chop"
else           → "Calm"
```

---

## Server — server.ts

- Port: `3001` (configurable via `PORT` env var)
- Feed file: `../public/seattle_master_feed.json` (relative to backend, configurable via `FEED_PATH`)
- Feed cache: **5-minute TTL** on every `GET /api/events` call
- Auth: Firebase Admin SDK — reads `GOOGLE_APPLICATION_CREDENTIALS` env var (service account JSON path)
- Admin guard: Firebase ID token must be valid + email must be in `ADMIN_EMAILS` env var

---

## Key Principles

1. **Connectors are stateless** — each `scrape()` call is independent; no connector stores state between calls.

2. **HTTP before Playwright** — prefer HTTP connectors (faster, no Chromium). Only use Playwright when the site requires JS rendering.

3. **Always provide fallbacks** — every external data fetch (snow APIs, water APIs, weather) has hardcoded fallback values. Never let a failed fetch crash the whole `SportsData` response.

4. **Two-phase dedup** — dedup happens BEFORE enrichment (cheap, key-based) AND AFTER enrichment (richer field comparison). Both are necessary.

5. **The feed file is the source of truth** — `seattle_master_feed.json` is what the frontend reads. The scrape pipeline writes it; the server reads it. They are decoupled.

6. **Enrichment is offline** — `gemini_tagger.ts` uses a local KNOWN_VENUES map, not live geocoding calls on every scrape. Adding a new venue means updating the map in that file.

7. **UW Huskies connector has a hardcoded date range** in the URL. Update it monthly or make it dynamic before the month rolls over.

8. **StubHub needs OAuth** — unlike other connectors, StubHub requires a client-credentials token fetch before every scrape session. If credentials expire, the connector silently returns 0 events.

9. **Fever is the most fragile** — relies on Playwright + JSON-LD structure from feverup.com. If they change their page structure, this breaks silently. Always verify Fever event counts after a scrape.

10. **Sports data cache is separate from event cache** — sports data (snow/weather/water) has a 15-min TTL; the event feed has a 5-min TTL. They are independent caches.

---

## Adding a New Event Source

1. Create `connectors/my_source.ts` implementing `DataConnector`
2. Set a unique `name` (used as the `source` field on events and for dedup)
3. Return `RawScrapedEvent[]` from `scrape()` — validated by `RawScrapedEventSchema`
4. Register in `connectors/index.ts`
5. Add to the `SourceConfig` array in `server.ts` for admin UI visibility
6. If the venue is fixed, add it to `KNOWN_VENUES` in `gemini_tagger.ts`

## Adding a New Environmental Data Source

1. Add fetch logic in `SportsDataService.ts` inside `fetchAllData()`
2. Always wrap in try/catch with a hardcoded fallback
3. Add the new field to `SportsDataSchema` in `schema.ts`
4. Expose it in `UnifiedInsightCard.jsx` if it's user-facing
