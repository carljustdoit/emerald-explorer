import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { EmeraldFeed, EmeraldEvent } from './types/schema.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let cachedFeed: EmeraldFeed | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadFeed(): Promise<EmeraldFeed> {
  const now = Date.now();
  if (cachedFeed && (now - lastLoadTime) < CACHE_TTL) {
    return cachedFeed;
  }

  try {
    const feedPath = process.env.FEED_PATH || join(process.cwd(), '..', 'public', 'seattle_master_feed.json');
    const data = await readFile(feedPath, 'utf-8');
    cachedFeed = JSON.parse(data) as EmeraldFeed;
    lastLoadTime = now;
    console.log(`[API] Loaded feed with ${cachedFeed.events.length} events`);
    return cachedFeed;
  } catch (error) {
    console.error('[API] Failed to load feed:', error);
    if (cachedFeed) return cachedFeed;
    throw error;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/environment', async (req, res) => {
  try {
    const feed = await loadFeed();
    res.json(feed.metadata.environment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch environment data' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const feed = await loadFeed();
    let events = feed.events;

    const { tag, kidFriendly, source, search, startDate, endDate, limit, offset } = req.query;

    if (tag) {
      const tags = (tag as string).split(',');
      events = events.filter(e => e.vibe_tags.some(t => tags.includes(t)));
    }

    if (kidFriendly !== undefined) {
      const isKidFriendly = kidFriendly === 'true';
      events = events.filter(e => e.is_kid_friendly === isKidFriendly);
    }

    if (source) {
      const sources = (source as string).split(',');
      events = events.filter(e => sources.includes(e.source));
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      events = events.filter(e =>
        e.title.toLowerCase().includes(searchLower) ||
        e.description.toLowerCase().includes(searchLower) ||
        e.location.name.toLowerCase().includes(searchLower)
      );
    }

    if (startDate) {
      events = events.filter(e => e.start_time >= (startDate as string));
    }

    if (endDate) {
      events = events.filter(e => e.start_time <= (endDate as string));
    }

    const total = events.length;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;

    events = events
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(offsetNum, offsetNum + limitNum);

    res.json({
      events,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
      metadata: {
        lastUpdated: feed.metadata.last_updated,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const feed = await loadFeed();
    const event = feed.events.find(e => e.id === req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const feed = await loadFeed();
    const tagCounts: Record<string, number> = {};

    for (const event of feed.events) {
      for (const tag of event.vibe_tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const tags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

app.get('/api/sources', async (req, res) => {
  try {
    const feed = await loadFeed();
    const sourceCounts: Record<string, number> = {};

    for (const event of feed.events) {
      sourceCounts[event.source] = (sourceCounts[event.source] || 0) + 1;
    }

    const sources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    res.json({ sources });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

app.get('/api/debug', async (req, res) => {
  try {
    const feed = await loadFeed();
    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify(feed, null, 2));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

async function triggerScrape(): Promise<void> {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['tsx', 'src/main.ts'], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });

      proc.on('close', (code) => {
        if (code === 0) {
          cachedFeed = null;
          resolve();
        } else {
          reject(new Error(`Scrape failed with code ${code}`));
        }
      });
    });
  } catch (error) {
    throw error;
  }
}

app.post('/api/admin/scrape', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[API] Triggering scrape...');
    await triggerScrape();
    const feed = await loadFeed();
    res.json({ success: true, eventCount: feed.events.length });
  } catch (error) {
    console.error('[API] Scrape failed:', error);
    res.status(500).json({ error: 'Scrape failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
  console.log(`[API] Endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/events`);
  console.log(`  GET  /api/events/:id`);
  console.log(`  GET  /api/environment`);
  console.log(`  GET  /api/tags`);
  console.log(`  GET  /api/sources`);
  console.log(`  POST /api/admin/scrape`);
});
