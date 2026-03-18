import test from 'node:test';
import assert from 'node:assert';
import { validateAndDeduplicate } from '../src/ingestion/orchestrator.js';
import { RawScrapedEvent } from '../src/types/schema.js';

test('Pipeline Stage 2: validateAndDeduplicate', async (t) => {
  await t.test('keeps valid events', () => {
    const events: RawScrapedEvent[] = [{
      title: 'Valid Concert Event',
      source: 'StubHub',
      url: 'https://example.com/event1',
      date: 'March 18, 2026',
    }];
    const result = validateAndDeduplicate(events);
    assert.strictEqual(result.length, 1);
  });

  await t.test('drops events with titles shorter than 3 chars', () => {
    const events: RawScrapedEvent[] = [{
      title: 'Hi',
      source: 'StubHub',
      url: 'https://example.com/event1',
    }];
    const result = validateAndDeduplicate(events);
    assert.strictEqual(result.length, 0);
  });

  await t.test('drops events with invalid schema shapes (bad URLs)', () => {
    const events: RawScrapedEvent[] = [{
      title: 'Valid Event Title',
      source: 'StubHub',
      url: 'not-a-url', // Fails URL validation
    }];
    const result = validateAndDeduplicate(events);
    assert.strictEqual(result.length, 0);
  });

  await t.test('drops events with unparseable dates that are too short', () => {
    const events: RawScrapedEvent[] = [{
      title: 'Valid Event Title',
      source: 'StubHub',
      url: 'https://example.com/event',
      date: 'M', // Fails date refine validation
    }];
    const result = validateAndDeduplicate(events);
    assert.strictEqual(result.length, 0);
  });

  await t.test('deduplicates events matching the exact source, title, and date', () => {
    const events: RawScrapedEvent[] = [
      {
        title: 'Symphony No. 9',
        source: 'Seattle Symphony',
        url: 'https://example.com/1',
        date: 'April 1, 2026',
      },
      {
        title: 'Symphony No. 9',
        source: 'Seattle Symphony',
        url: 'https://example.com/2',
        date: 'April 1, 2026 8:00 PM', // Date normalized only takes the first part before space, so this matches
      },
      {
        title: 'Symphony No. 9',
        source: 'Seattle Symphony',
        url: 'https://example.com/3',
        date: 'April 2, 2026', // Different date
      }
    ];
    const result = validateAndDeduplicate(events);
    assert.strictEqual(result.length, 2); // Keeps 1st and 3rd
  });
});
