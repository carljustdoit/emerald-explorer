# Emerald Explorer — Master Reference

Built by **Antigravity**. Seattle-centric event discovery platform designed for co-parenting life, with dual-mode UI (Parenting/Family vs. Solo), real-time weather/snow/water data, and AI-enriched event feeds.

---

## Project Structure

```
emerald-explorer/
├── src/                        Frontend (React 19 + Vite)
│   ├── pages/                  Home, Discovery, Settings, Login, Signup, Admin
│   ├── components/             Navigation, AdaptiveHeroCard, BrandBanner,
│   │                           UnifiedInsightCard, EventDetailModal, SocialPulse
│   ├── context/                AppContext, AuthContext
│   ├── hooks/                  useApi, useRotationEngine, useViabilityEngine
│   ├── services/               api.js (fetch wrappers for backend endpoints)
│   ├── utils/                  icsExport.js
│   ├── data.js                 mockResources + static event data
│   ├── firebase.js             Firebase client config
│   ├── App.jsx                 Router + auth wrapper
│   └── index.css               CSS variables + global styles
├── backend/src/                Node.js/TypeScript backend
│   ├── ingestion/              Scrapers + connectors + orchestrator
│   ├── enrichment/             Gemini AI tagger (gemini_tagger.ts)
│   ├── services/               SportsDataService.ts
│   ├── types/                  Zod validation schemas (schema.ts)
│   ├── deployment/             CDN upload script
│   └── server.ts               Express API server (port 3001)
├── public/
│   └── seattle_master_feed.json   Event data (source of truth)
├── .env                        Firebase keys + Vite env vars
├── backend/.env                Backend-specific env (PORT, FEED_PATH, AWS, etc.)
├── vite.config.js              Proxies /api → localhost:3001
└── index.html                  Root HTML, loads Inter + Outfit fonts
```

---

## Tech Stack

| Layer       | Technology                                             |
|-------------|--------------------------------------------------------|
| Frontend    | React 19, Vite 7, React Router DOM 7                  |
| Styling     | CSS variables, inline styles, glassmorphism            |
| Icons       | Lucide React                                           |
| Maps        | React Leaflet + Leaflet 1.9                            |
| Auth        | Firebase 12 (email/password + Google OAuth)            |
| Backend     | Node.js, TypeScript 5.9, Express 5                     |
| Scraping    | Playwright (browser automation), Cheerio (HTML parse)  |
| AI          | Google Gemini (event tagging + geocoding)              |
| Validation  | Zod 3                                                  |
| Storage     | AWS S3 (CDN), localStorage (agenda + theme)            |
| Env data    | NWS weather, USGS water, NOAA tides, NDBC wind         |

---

## Pages

### Home (`/`)
- User's agenda organized by Today / This Week / Later
- Interactive Leaflet map with route polyline connecting today's events
- UnifiedInsightCard: weather forecast, mountain snow depths, water/wind metrics
- BrandBanner header

### Discovery (`/discovery`)
- Event discovery with filters: Category, Timeframe, Location
- Trending section (hardcoded: Cherry Blossom Walk, Art Walk, Pike Place)
- Outdoor Activities panel: ski resorts + paddling spots, pinnable to home agenda
- Main event feed rendered as AdaptiveHeroCard grid
- EventDetailModal on card click

### Settings (`/settings`)
- Parenting rotation calendar (Weekly, 2-2-5-5, Manual patterns)
- Manual override calendar (click dates to toggle)
- Scheduling constraints (no events before/after specified times)
- Rest days toggle (break every other day)
- Theme toggle (Auto / Light-Parenting / Dark-Solo)
- Summer mode override (force golden hour)
- Export to ICS
- Sign out

### Login / Signup
- Email/password + Google OAuth
- ProtectedRoute wrapper in App.jsx guards all non-auth pages

### Admin (`/admin`)
- Visible only to users in `VITE_ADMIN_EMAILS`
- Scrape trigger, live SSE stream, event management

---

## State Management — AppContext

Central provider wrapping the entire app. Exposes:

```js
const {
    rotation,              // useRotationEngine() — parenting schedule
    viability,             // useViabilityEngine() — event scoring engine
    agenda,                // localStorage-backed array of { ...event, status }
    addToAgenda,           // (event, status='added') → upsert
    removeFromAgenda,      // (eventId) → filter out
    preferences,           // { breakEveryOtherDay, noEventsBefore, noEventsAfter }
    updatePreferences,     // shallow merge
    toggleSummerMode,      // viability.setForceSummerMode toggle
    theme,                 // 'auto' | 'light' | 'dark'
    setTheme,
    effectiveIsParenting,  // computed: theme==='light' || (auto && rotation.isParentingWeek)
    mockResources          // from data.js — user's gear (Kayak, Ikon Pass, etc.)
} = useApp();
```

AuthContext (separate):
```js
const { user, isAdmin, loading, signup, login, loginWithGoogle, logout } = useAuth();
```

---

## Hooks

### useRotationEngine
Calculates parenting schedule from a start date + rotation pattern.

```js
Patterns: WEEKLY [7,7], TWO_TWO_FIVE_FIVE [2,2,5,5], TWO_TWO_THREE [2,2,3], MANUAL []
rotationStartDate: 2026-03-09 (baseline)

Returns: { isParentingWeek, pattern, setPattern, rotationStartDate,
           overrides, toggleMode, setManualOverride, getScheduleForRange }
```

### useViabilityEngine
Scores events 0–100 based on environmental conditions + user preferences.

```js
calculateScore(event, resources, isParenting, preferences, agenda) → 0-100
Hard zeros: non-kid-friendly during parenting week, time window violations
Soft penalties: back-to-back days, missing gear
Bonuses: golden hour activities, good snow/water conditions

Returns: { calculateScore, isGoldenHour, forceSummerMode, setForceSummerMode,
           envData, forecast, sportsData }
```

### useApi (useEvents, useSportsData, etc.)
Thin wrappers over `services/api.js` with loading/error/pagination state.

---

## Backend API (Express, port 3001)

### Public
| Method | Path                   | Description                              |
|--------|------------------------|------------------------------------------|
| GET    | /api/health            | Health check                             |
| GET    | /api/events            | Events with filters (tag, kidFriendly, search, limit, offset) |
| GET    | /api/events/:id        | Single event                             |
| GET    | /api/environment       | Environmental metadata                   |
| GET    | /api/tags              | Tag statistics                           |
| GET    | /api/sources           | Source statistics                        |
| GET    | /api/sports-data       | Real-time weather/snow/water (15m cache) |
| GET    | /api/debug             | Full feed dump                           |

### Admin (Firebase token + email in ADMIN_EMAILS)
| Method | Path                          | Description                   |
|--------|-------------------------------|-------------------------------|
| POST   | /api/admin/scrape             | Trigger ingestion pipeline    |
| GET    | /api/admin/scrape/stream      | SSE scrape progress           |
| GET    | /api/admin/events             | All events (no pagination)    |
| PUT    | /api/admin/events/:id         | Update event                  |
| DELETE | /api/admin/events/:id         | Delete event                  |
| GET    | /api/admin/live-events        | SSE live scraped events       |
| POST   | /api/admin/live-events/clear  | Clear live event buffer       |
| POST   | /api/admin/regeocode          | Re-geocode all events         |

---

## Event Ingestion Pipeline

1. **Source Connectors** — Events12, 19hz, Ticketmaster, Seattle Symphony, Seattle Opera, UW Arts, UW Huskies, Jazz Alley, StubHub, Fever
2. **Validation** — Zod schemas in `types/schema.ts`
3. **Deduplication** — By title + date
4. **Gemini Enrichment** — Vibe tags, kid-friendly flags, geocoding, image extraction
5. **Greenlight** — Final Zod validation pass
6. **Deploy** — Write to `public/seattle_master_feed.json` (+ optional S3 upload)

---

## Design System

### Color Modes

**Light (Parenting):**
- `--bg-primary: #f5f3ef` (warm beige)
- `--accent-primary: #2d6a4f` (forest green)
- `--text-strong: #1a1a1a`
- Glass: `rgba(255,255,255,0.72)` + `blur(24px)`

**Dark (Solo):**
- `--solo-bg: #0c0f1a` (deep navy)
- `--solo-accent: #c8e66e` (lime green)
- `--solo-text-strong: #e8e6e1`
- Glass: `rgba(20,24,37,0.82)` + `blur(24px)`

Solo mode toggled by adding `solo-mode` class to `<body>` in App.jsx.

### Typography
- Headers: **Outfit** (500–800 weight), loaded from Google Fonts
- Body: **Inter** (400–600 weight)
- Tight letter-spacing: -0.01em to -0.03em

### Transitions
- `--transition-smooth: all 0.35s cubic-bezier(0.16, 1, 0.3, 1)` (elastic)
- `--transition-fast: all 0.2s ease`

### Radius
- `--radius-xl: 20px` (cards), `--radius-lg: 14px`, `--radius-md: 10px`

---

## Firebase

- **Project**: emerald-explorer-cf68b
- **Auth**: email/password + Google OAuth
- **Admin check**: email must be in `VITE_ADMIN_EMAILS` env var
- Backend uses Admin SDK with service account JSON (path in `FIREBASE_SERVICE_ACCOUNT_PATH`)

---

## Known Issues Fixed

### Discovery Page — Crash on Load
**Root cause**: `Discovery.jsx` only destructured `{ agenda, preferences, effectiveIsParenting }` from `useApp()`, but referenced these additional values that were never in scope:

| Used at | Identifier         | Fix                              |
|---------|--------------------|----------------------------------|
| L136, 280 | `viability`      | Destructure from `useApp()`      |
| L136, 280 | `mockResources`  | Destructure from `useApp()`      |
| L280    | `rotation`         | Destructure from `useApp()`      |
| L200, 294 | `removeFromAgenda` | Destructure from `useApp()`   |
| L202, 293, 295 | `addToAgenda` | Destructure from `useApp()`  |

All five are exposed by `AppContext` — they just weren't being pulled in.

---

## Environment Variables

**Frontend (`.env`):**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_ADMIN_EMAILS=carljustdoit@gmail.com
```

**Backend (`backend/.env`):**
```
PORT=3001
FEED_PATH=../public/seattle_master_feed.json
FIREBASE_SERVICE_ACCOUNT_PATH
TICKETMASTER_API_KEY
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET_NAME
```
