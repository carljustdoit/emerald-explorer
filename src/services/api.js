const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function fetchEvents(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.kidFriendly !== undefined) params.set('kidFriendly', String(filters.kidFriendly));
  if (filters.source) params.set('source', filters.source);
  if (filters.search) params.set('search', filters.search);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const response = await fetch(`${API_BASE}/events?${params}`);
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
}

export async function fetchEvent(id) {
  const response = await fetch(`${API_BASE}/events/${id}`);
  if (!response.ok) throw new Error('Failed to fetch event');
  return response.json();
}

export async function fetchEnvironment() {
  const response = await fetch(`${API_BASE}/environment`);
  if (!response.ok) throw new Error('Failed to fetch environment');
  return response.json();
}

export async function fetchTags() {
  const response = await fetch(`${API_BASE}/tags`);
  if (!response.ok) throw new Error('Failed to fetch tags');
  return response.json();
}

export async function fetchSources() {
  const response = await fetch(`${API_BASE}/sources`);
  if (!response.ok) throw new Error('Failed to fetch sources');
  return response.json();
}

export async function triggerScrape(apiKey) {
  const response = await fetch(`${API_BASE}/admin/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  });
  if (!response.ok) throw new Error('Failed to trigger scrape');
  return response.json();
}
