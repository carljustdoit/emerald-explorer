# Emerald Sourcing Engine

Backend ETL pipeline for aggregating Seattle events and environmental data.

## Quick Start

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run the pipeline
npm run scrape
```

## Configuration

### Optional: CDN Configuration

For production, configure AWS S3 or Cloudflare R2:

```
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
CDN_BUCKET=emerald-explorer-cdn
CDN_PUBLIC_URL=https://cdn.yourdomain.com
```

Without these, the pipeline writes `seattle_master_feed.json` to the `OUTPUT_DIR` (defaults to `../public`).

## Data Pipeline

### Phase 1: Ingestion

- **USGS**: Lake Union temperature, Cedar River flow (free API)
- **WSDOT**: Snoqualmie/Stevens Pass snow depth (free API)
- **Open-Meteo**: Weather conditions, sunset time (free API)
- **Direct HTTP + Cheerio**: Scrapes Events12, EverOut for events

### Phase 2: Enrichment

- **Rule-based date parsing**: Converts various date formats to ISO 8601
- **Venue lookup**: Maps known Seattle venues to coordinates
- **Kid-friendliness detection**: Keyword-based classification
- **Vibe tagging**: Topic classification for activity filtering

### Phase 3: Deployment

- Combines all data into `seattle_master_feed.json`
- Uploads to CDN or writes locally

## Output Schema

```typescript
interface EmeraldFeed {
  metadata: {
    last_updated: string;
    environment: {
      snoqualmie_snow_inches: number;
      lake_union_temp_f: number;
      wind_speed_mph: number;
      sunset_time: string;
      // ... more fields
    };
  };
  events: Array<{
    id: string;
    source: string;
    title: string;
    description: string;
    start_time: string; // ISO 8601
    end_time: string;
    is_kid_friendly: boolean;
    vibe_tags: string[];
    location: { name: string; lat: number; lon: number };
    url: string;
  }>;
}
```

## Running Locally

```bash
cd backend
npm run scrape
```

This will:
1. Fetch real weather/environment data from public APIs
2. Scrape event websites (or use fallback mock data)
3. Process and enrich events locally
4. Write to `../public/seattle_master_feed.json`

## GitHub Actions (Production)

To enable automatic daily runs, create `.github/workflows/scrape.yml`:

```yaml
name: Daily Scrape

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd backend && npm install
      - run: cd backend && npm run scrape
        env:
          CDN_BUCKET: ${{ secrets.CDN_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

Add secrets in GitHub repo Settings > Secrets and variables > Actions.

## Project Structure

```
backend/
├── src/
│   ├── ingestion/
│   │   ├── usgs.ts         # Water data (free API)
│   │   ├── wsdot.ts        # Pass conditions + weather
│   │   └── firecrawl_scraper.ts  # Event scraping (cheerio)
│   ├── enrichment/
│   │   └── gemini_tagger.ts      # Rule-based processing
│   ├── deployment/
│   │   └── upload_to_cdn.ts      # S3/R2 upload
│   ├── types/
│   │   └── schema.ts        # TypeScript schemas
│   └── main.ts              # Orchestrator
├── package.json
├── tsconfig.json
└── .env.example
```

## Dependencies

- **cheerio**: HTML parsing for web scraping
- **zod**: Schema validation
- **@aws-sdk**: S3/R2 upload (optional)

No external AI APIs required - all processing is rule-based.

## License

MIT
