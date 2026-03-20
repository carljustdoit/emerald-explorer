import 'dotenv/config';
import express, { Response, Request, NextFunction } from 'express';
import cors from 'cors';
import { EmeraldFeed, EmeraldEvent } from './types/schema.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { scraperEmitter, StreamEvent } from './ingestion/scraper_events.js';
import admin from 'firebase-admin';
import { SportsDataService } from './services/SportsDataService.js';

// Initialize Firebase Admin
let db: admin.firestore.Firestore | null = null;
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  db = admin.firestore();
  console.log('[Auth] Firebase Admin & Firestore initialized');
} catch (error) {
  console.error('[Auth] Failed to initialize Firebase Admin:', error);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Admin emails from env
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

// Auth Middleware
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email || !ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

app.use(cors());
app.use(express.json());

// Protect all admin routes
app.use('/api/admin', authMiddleware);

// SSE clients
let scrapeClients: Response[] = [];

// Real-time events store (for streaming)
let liveEvents: EmeraldEvent[] = [];
let scrapeStatus: 'idle' | 'running' | 'complete' = 'idle';

let currentScrapeProgress = {
  progress: 0,
  source: 'Ready',
  message: 'Idle',
  logs: [] as string[]
};

// Listen to scraper events to broadcast them to the live-events SSE
// (Note: `sendScrapeProgress` is managed exclusively by `triggerScrape` & `updateProgress` now)
scraperEmitter.on('event', (streamEvent: StreamEvent) => {
  // we no longer emit progress: 0 here to avoid hijacking the progress bar UI
});

app.get('/api/admin/scrape/stream', (req, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send persistent status upon first connection 
  // (Prevents progress bar resets if user refreshes page)
  res.write(`data: ${JSON.stringify(currentScrapeProgress)}\n\n`);
  
  scrapeClients.push(res);
  
  req.on('close', () => {
    scrapeClients = scrapeClients.filter(client => client !== res);
  });
});

function sendScrapeProgress(data: { progress: number; source: string; message: string; logs: string[] }) {
  currentScrapeProgress = data;
  
  // 1. Broadcast to local SSE clients
  scrapeClients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  // 2. Persist to Firestore for other instances (Universal Progress)
  if (db) {
    db.collection('system').doc('scraper').set({
      ...data,
      status: scrapeStatus,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error('[Firestore] Progress sync failed:', err));
  }
}

// Universal Progress Listener: All instances watch Firestore to stay in sync
if (db) {
  db.collection('system').doc('scraper').onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data() as any;
      // If Firestore has a newer status than our local variable, adopt it
      if (data.status) scrapeStatus = data.status;
      
      // Sync local progress variable so new SSE connections get latest Correct data
      currentScrapeProgress = {
        progress: data.progress || 0,
        source: data.source || '',
        message: data.message || '',
        logs: data.logs || []
      };

      // Broadcast to any local SSE clients that might be waiting
      scrapeClients.forEach(client => {
        client.write(`data: ${JSON.stringify(currentScrapeProgress)}\n\n`);
      });
    }
  });
}

let cachedFeed: EmeraldFeed | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function clearFeedCache(): void {
  cachedFeed = null;
  lastLoadTime = 0;
  console.log('[API] Feed cache cleared');
}

// Admin configuration - in production this would be in a database
interface SourceConfig {
  name: string;
  url: string;
  enabled: boolean;
  category: string;
}

let sourceConfigs: SourceConfig[] = [
  { name: 'Events12', url: 'https://www.events12.com/seattle/', enabled: true, category: 'general' },
  { name: '19hz', url: 'https://19hz.info/eventlisting_Seattle.php', enabled: true, category: 'music' },
  { name: 'Seattle Symphony', url: 'https://www.seattlesymphony.org/concerttickets/calendar', enabled: true, category: 'music' },
  { name: 'Seattle Opera', url: 'https://www.seattleopera.org/calendar/', enabled: true, category: 'art' },
  { name: 'UW Arts', url: 'https://artsevents.washington.edu/', enabled: true, category: 'art' },
  { name: 'UW Huskies', url: 'https://gohuskies.com/calendar/print/month/0/3-1-2026/3-31-2026/null', enabled: true, category: 'sports' },
  { name: 'Ticketmaster', url: 'https://app.ticketmaster.com/discovery/v2/events.json', enabled: true, category: 'general' },
  { name: 'Jazz Alley', url: 'https://www.jazzalley.com/www-home/calendar.jsp', enabled: true, category: 'music' },
  { name: 'StubHub', url: 'https://www.stubhub.com/', enabled: true, category: 'music' },
  { name: 'Fever', url: 'https://feverup.com/en/seattle/candlelight', enabled: true, category: 'music' },
];

async function loadFeed(): Promise<EmeraldFeed> {
  const now = Date.now();
  if (cachedFeed && (now - lastLoadTime) < CACHE_TTL) {
    return cachedFeed;
  }

  try {
    const feedPath = process.env.FEED_PATH || join(process.cwd(), 'public', 'seattle_master_feed.json');
    try {
      const data = await readFile(feedPath, 'utf-8');
      cachedFeed = JSON.parse(data) as EmeraldFeed;
      lastLoadTime = now;
      console.log(`[API] Loaded feed with ${cachedFeed.events.length} events`);
      return cachedFeed;
    } catch (err) {
      console.warn(`[API] Master feed not found at ${feedPath}, returning empty feed.`);
      const emptyFeed: EmeraldFeed = {
        metadata: {
          last_updated: new Date().toISOString(),
          environment: {
            sunset_time: 'N/A',
            conditions: 'N/A',
          }
        },
        events: []
      };
      cachedFeed = emptyFeed;
      return emptyFeed;
    }
  } catch (error) {
    console.error('[API] Unexpected error in loadFeed:', error);
    if (cachedFeed) return cachedFeed;
    throw error;
  }
}

async function saveFeed(feed: EmeraldFeed): Promise<void> {
  const feedPath = process.env.FEED_PATH || join(process.cwd(), 'public', 'seattle_master_feed.json');
  await writeFile(feedPath, JSON.stringify(feed, null, 2));
  cachedFeed = feed;
  lastLoadTime = Date.now();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Live events API - returns events in real-time as they're scraped
app.get('/api/admin/live-events', (req, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send current live events
  res.write(`data: ${JSON.stringify({ type: 'init', events: liveEvents, status: scrapeStatus })}\n\n`);
  
  // Listen for new events
  const onEvent = (streamEvent: StreamEvent) => {
    if (streamEvent.type === 'event') {
      res.write(`data: ${JSON.stringify({ type: 'event', event: streamEvent.data })}\n\n`);
    }
  };
  
  const onComplete = (streamEvent: StreamEvent) => {
    res.write(`data: ${JSON.stringify({ type: 'complete', total: streamEvent.data.totalEvents })}\n\n`);
    res.end();
  };
  
  scraperEmitter.on('event', onEvent);
  scraperEmitter.on('complete', onComplete);
  
  req.on('close', () => {
    scraperEmitter.off('event', onEvent);
    scraperEmitter.off('complete', onComplete);
  });
});

// Get current live events (REST API)
app.get('/api/live-events', (req, res) => {
  res.json({ events: liveEvents, status: scrapeStatus, count: liveEvents.length });
});

// Clear live events
app.post('/api/admin/live-events/clear', (req, res) => {
  liveEvents = [];
  scrapeStatus = 'idle';
  res.json({ success: true });
});

// Environment data
app.get('/api/environment', async (req, res) => {
  try {
    const feed = await loadFeed();
    res.json(feed.metadata.environment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch environment data' });
  }
});

// Trending events — aggregated from all user agendas in Firestore
let trendingCache: { data: any[]; ts: number } = { data: [], ts: 0 };
const TRENDING_TTL = 15 * 60 * 1000; // 15 min

app.get('/api/trending', async (req, res) => {
  try {
    if (!db) return res.json([]);

    if (Date.now() - trendingCache.ts < TRENDING_TTL) {
      return res.json(trendingCache.data);
    }

    const usersSnap = await db.collection('users').get();
    const counts = new Map<string, { id: string; title: string; count: number }>();

    usersSnap.forEach(doc => {
      const items: any[] = doc.data().agenda || [];
      items.forEach(item => {
        if (!item?.id || !item?.title) return;
        const existing = counts.get(item.id) ?? { id: item.id, title: item.title, count: 0 };
        existing.count++;
        counts.set(item.id, existing);
      });
    });

    const top3 = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    trendingCache = { data: top3, ts: Date.now() };
    res.json(top3);
  } catch (error) {
    console.error('[API] Trending error:', error);
    res.json([]);
  }
});

// Real-time sports data (Snow/Water/Weather)
app.get('/api/sports-data', async (req, res) => {
  try {
    const forceReload = req.query.reload === 'true';
    const data = await SportsDataService.getSportsData(forceReload);
    res.json(data);
  } catch (error) {
    console.error('[API] Error fetching sports data:', error);
    res.status(500).json({ error: 'Failed to fetch sports data' });
  }
});

// Events list with filters
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
    const limitNum = Math.min(parseInt(limit as string) || 50, 500);
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

// Single event
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

// Tags
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

// Sources
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

// Debug feed
app.get('/api/debug', async (req, res) => {
  try {
    const feed = await loadFeed();
    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify(feed, null, 2));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// ============ ADMIN ENDPOINTS ============

// Get all events (admin view - no pagination limit)
app.get('/api/admin/events', async (req, res) => {
  try {
    const feed = await loadFeed();
    let events = feed.events;

    const { source, search, tag, startDate, endDate } = req.query;

    if (source) {
      events = events.filter(e => e.source === source);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      events = events.filter(e =>
        e.title.toLowerCase().includes(searchLower) ||
        e.description.toLowerCase().includes(searchLower)
      );
    }

    if (tag) {
      events = events.filter(e => e.vibe_tags.includes(tag as string));
    }

    if (startDate) {
      events = events.filter(e => e.start_time >= (startDate as string));
    }

    if (endDate) {
      events = events.filter(e => e.start_time <= (endDate as string));
    }

    res.json({ events, total: events.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Update live event (for fixing validated events)
app.put('/api/admin/live-events/:id', (req, res) => {
  const index = liveEvents.findIndex(e => e.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Live event not found' });
  }
  
  liveEvents[index] = { ...liveEvents[index], ...req.body };
  res.json(liveEvents[index]);
});

// Delete live event
app.delete('/api/admin/live-events/:id', (req, res) => {
  const index = liveEvents.findIndex(e => e.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Live event not found' });
  }
  
  liveEvents.splice(index, 1);
  res.json({ success: true });
});

// Update event (file-based)
app.put('/api/admin/events/:id', async (req, res) => {
  try {
    const feed = await loadFeed();
    const index = feed.events.findIndex(e => e.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }

    feed.events[index] = { ...feed.events[index], ...req.body };
    await saveFeed(feed);
    clearFeedCache();

    res.json(feed.events[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
app.delete('/api/admin/events/:id', async (req, res) => {
  try {
    const feed = await loadFeed();
    const index = feed.events.findIndex(e => e.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }

    feed.events.splice(index, 1);
    await saveFeed(feed);
    clearFeedCache();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Get source configuration
app.get('/api/admin/sources', async (req, res) => {
  try {
    const feed = await loadFeed();
    const sourceCounts: Record<string, number> = {};

    for (const event of feed.events) {
      sourceCounts[event.source] = (sourceCounts[event.source] || 0) + 1;
    }

    const configsWithCounts = sourceConfigs.map(config => ({
      ...config,
      count: sourceCounts[config.name] || 0
    }));

    res.json({ sources: configsWithCounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch source counts' });
  }
});

// Update source configuration
app.put('/api/admin/sources/:name', (req, res) => {
  const { name } = req.params;
  const index = sourceConfigs.findIndex(s => s.name === name);

  if (index === -1) {
    return res.status(404).json({ error: 'Source not found' });
  }

  sourceConfigs[index] = { ...sourceConfigs[index], ...req.body };
  res.json(sourceConfigs[index]);
});

// Trigger scrape
async function triggerScrape(selectedSources?: string[], mode: 'overwrite' | 'append' = 'overwrite'): Promise<void> {
  const sourcesToRun = selectedSources && selectedSources.length > 0 
      ? selectedSources 
      : sourceConfigs.filter(c => c.enabled).map(c => c.name);
      
  const totalSteps = sourcesToRun.length * 4; // Fetch, Validate, Enrich, Greenlight per source
  let currentStep = 0;
  const logs: string[] = [];

  const updateProgress = (source: string, message: string) => {
    currentStep++;
    logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    sendScrapeProgress({
      progress: Math.min(Math.round((currentStep / totalSteps) * 100), 99),
      source,
      message,
      logs: logs.slice(-50), // Keep last 50 logs
    });
  };

  try {
    const { scrapeAllEventSources, validateAndDeduplicate } = await import('./ingestion/orchestrator.js');
    const { enrichAllEvents } = await import('./enrichment/gemini_tagger.js');
    const { EmeraldEventSchema } = await import('./types/schema.js');
    
    let finalEvents: any[] = [];
    if (mode === 'append' && cachedFeed) {
       finalEvents = [...cachedFeed.events];
    }

    const eventMap = new Map();
    finalEvents.forEach(e => eventMap.set(e.id, e));

    for (const source of sourcesToRun) {
      updateProgress(source, `[${source}] Starting scrape...`);
      const rawEvents = await scrapeAllEventSources(source);
      
      if (rawEvents.length === 0) {
        updateProgress(source, `[${source}] Scraped 0 events. Skipping enrichment.`);
        // Emit two dummy steps to keep progress bar accurate
        currentStep += 2; 
        continue;
      }

      updateProgress(source, `[${source}] Validating ${rawEvents.length} raw events...`);
      const validRawEvents = validateAndDeduplicate(rawEvents);

      updateProgress(source, `[${source}] Enriching ${validRawEvents.length} events using AI...`);
      const enrichedEvents = await enrichAllEvents(validRawEvents);

      updateProgress(source, `[${source}] Greenlighting schema for ${enrichedEvents.length} enriched events...`);
      
      const newGreenlighted = [];
      for (const event of enrichedEvents) {
        if (EmeraldEventSchema.safeParse(event).success) {
          newGreenlighted.push(event);
          eventMap.set(event.id, event);
          // 🚀 Crucial: Tell frontend an event is ready immediately
          scraperEmitter.emitEvent(event);
        } else {
          console.warn(`[Stage 4] Validation failed for enriched event: ${event.title}`);
        }
      }
      
      updateProgress(source, `[${source}] Finished processing. Output: ${newGreenlighted.length} deployable events.`);
    }

    finalEvents = Array.from(eventMap.values());

    updateProgress('Deploy', `Saving ${finalEvents.length} total events to master feed...`);

    // Save Feed To Disk
    if (cachedFeed) {
       cachedFeed.events = finalEvents;
       cachedFeed.metadata.last_updated = new Date().toISOString();
       await saveFeed(cachedFeed);
    } else {
       await saveFeed({
          metadata: { last_updated: new Date().toISOString(), environment: {} as any },
          events: finalEvents
       });
    }

    // Final updates
    liveEvents = finalEvents;
    scrapeStatus = 'complete';
    
    // Emit total completion
    scraperEmitter.emitComplete(finalEvents.length);
    
    sendScrapeProgress({
      progress: 100,
      source: 'Complete',
      message: `Scraping complete! ${finalEvents.length} total events in feed.`,
      logs: ['Done!'],
    });

    // Final Firestore update to ensure status is closed
    if (db) {
      await db.collection('system').doc('scraper').update({
        status: 'complete',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    scrapeStatus = 'idle';
    if (db) {
      await db.collection('system').doc('scraper').update({
        status: 'idle',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    sendScrapeProgress({
      progress: 0,
      source: 'Failed',
      message: `Scrape failed: ${error}`,
      logs: [`Error: ${error}`],
    });
    throw error;
  }
}

app.post('/api/admin/scrape', async (req, res) => {
  try {
    const { sources, mode } = req.body;
    const userEmail = (req as any).user?.email || 'Unknown Admin';

    if (db) {
      const scraperDoc = await db.collection('system').doc('scraper').get();
      if (scraperDoc.exists) {
        const data = scraperDoc.data();
        const startTime = data?.startTime?.toDate();
        const now = new Date();
        const diffMinutes = startTime ? (now.getTime() - startTime.getTime()) / 60000 : 999;

        // If scraper says it's running AND it started less than 45 mins ago, block concurrent run
        if (data?.status === 'running' && diffMinutes < 45) {
          return res.status(409).json({ 
            error: `Scraper is already running! Triggered by ${data.requestedBy} at ${startTime?.toLocaleTimeString()}.`,
            requestBy: data.requestedBy
          });
        }
      }

      // Claim the lock
      await db.collection('system').doc('scraper').set({
        status: 'running',
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        requestedBy: userEmail,
        progress: 0,
        source: 'Starting',
        message: 'Initializing scrape pipeline...',
        logs: [`Scrape triggered by ${userEmail}`]
      }, { merge: true });
    }

    console.log(`[API] Triggering scrape... Sources: ${sources?.join(', ') || 'ALL'}, Mode: ${mode}`);
    
    // Clear live events locally and start pipeline
    liveEvents = [];
    scrapeStatus = 'running';
    
    // Start scrape in background
    triggerScrape(sources, mode).then(async () => {
      clearFeedCache();
      const feed = await loadFeed();
      liveEvents = feed.events;
      scrapeStatus = 'complete';
      console.log(`[API] Scrape complete, ${feed.events.length} events`);
    }).catch(err => {
      scrapeStatus = 'idle';
      console.error('[API] Scrape error:', err);
    });
    
    res.json({ success: true, message: 'Scrape started' });
  } catch (error) {
    console.error('[API] Scrape failed:', error);
    res.status(500).json({ error: 'Scrape failed' });
  }
});

// Re-geocode all events endpoint
app.post('/api/admin/regeocode', async (req, res) => {
  try {
    const { regeocodeEvent } = await import('./enrichment/gemini_tagger.js');
    const feed = await loadFeed();
    let fixed = 0;
    
    for (const event of feed.events) {
      const oldLat = event.location?.lat;
      const newEvent = regeocodeEvent(event);
      const newLat = newEvent.location?.lat;
      
      if (oldLat !== newLat) {
        event.location = newEvent.location;
        fixed++;
      }
    }
    
    // Save updated feed
    const feedPath = process.env.FEED_PATH || join(process.cwd(), 'public', 'seattle_master_feed.json');
    await writeFile(feedPath, JSON.stringify(feed, null, 2));
    cachedFeed = feed;
    
    res.json({ success: true, fixedCount: fixed });
  } catch (error) {
    console.error('[API] Re-geocode failed:', error);
    res.status(500).json({ error: 'Re-geocode failed' });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[API] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[API] Endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/events`);
  console.log(`  GET  /api/events/:id`);
  console.log(`  GET  /api/environment`);
  console.log(`  GET  /api/tags`);
  console.log(`  GET  /api/sources`);
  console.log(`  POST /api/admin/scrape`);
  console.log(`  GET  /api/admin/events`);
  console.log(`  PUT  /api/admin/events/:id`);
  console.log(`  DELETE /api/admin/events/:id`);
  console.log(`  GET  /api/admin/sources`);
  console.log(`  PUT  /api/admin/sources/:name`);
  console.log(`  POST /api/admin/regeocode`);
});
