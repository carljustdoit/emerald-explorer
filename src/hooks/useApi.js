import { useState, useEffect, useCallback } from 'react';
import { fetchEvents, fetchEnvironment, fetchTags, fetchSportsData } from '../services/api';

export function useEvents(filters = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents(filters);
      setEvents(data.events);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.tag, filters.kidFriendly, filters.search, filters.limit, filters.offset]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || loading) return;
    setLoading(true);
    try {
      const data = await fetchEvents({
        ...filters,
        offset: (pagination.offset || 0) + (pagination.limit || 50),
      });
      setEvents(prev => [...prev, ...data.events]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination, filters, loading]);

  return { events, loading, error, pagination, loadEvents, loadMore, refetch: loadEvents };
}

export function useEnvironment() {
  const [environment, setEnvironment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadEnvironment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEnvironment();
      setEnvironment(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnvironment();
  }, [loadEnvironment]);

  return { environment, loading, error, refetch: loadEnvironment };
}

export function useTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags()
      .then(data => setTags(data.tags))
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, []);

  return { tags, loading };
}

export function useSportsData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSportsData();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [loadData]);

  return { data, loading, error, refetch: loadData };
}
