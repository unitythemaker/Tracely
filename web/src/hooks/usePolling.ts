'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface UsePollingOptions {
  interval?: number; // Poll interval in ms, default 5000
  enabled?: boolean; // Whether polling is enabled, default true
  immediate?: boolean; // Whether to call immediately on mount, default false
}

interface UsePollingReturn {
  isRefreshing: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function usePolling(
  fetchFn: () => Promise<void>,
  options: UsePollingOptions = {}
): UsePollingReturn {
  const { interval = 5000, enabled = true, immediate = false } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;

    setIsRefreshing(true);
    try {
      await fetchFn();
      if (mountedRef.current) {
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Polling fetch error:', error);
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [fetchFn]);

  // Immediate call on mount if requested
  useEffect(() => {
    if (immediate && enabled) {
      refresh();
    }
  }, [immediate, enabled, refresh]);

  // Setup polling interval
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      refresh();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { isRefreshing, lastUpdated, refresh };
}
