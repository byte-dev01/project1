
import { useState, useCallback } from 'react';
import { apiClient } from './ApiClient';

interface APIRequest {
  url: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

interface CacheOptions<T> {
  ttl?: number; // Time to live in milliseconds
  offlineFallback?: T;
}

interface PaginatedResponse<T = any> {
  items: T[];
  hasMore: boolean;
  total?: number;
  page?: number;
}

class APIOptimizer {
  private requestCache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<any>>();
  
  /**
   * Fetch with cache and offline support - elegant async pattern
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions<T> = {}
  ): Promise<T> {
    const { ttl = 60000, offlineFallback } = options;
    
    // Check cache first
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    
    // Return pending request if exists
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // Make request with elegant error handling
    const promise = fetcher()
      .then(data => {
        this.requestCache.set(key, { data, timestamp: Date.now() });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        // Return offline fallback if provided
        if (offlineFallback !== undefined) {
          return offlineFallback;
        }
        throw error;
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
  
  /**
   * Implement request deduplication
   */
  async fetchWithDedup(url: string, options: RequestInit = {}): Promise<any> {
    const key = `${url}_${JSON.stringify(options)}`;
    
    return this.fetchWithCache(
      key,
      async () => {
        const response = await fetch(url, options);
        return response.json();
      },
      { ttl: 60000 }
    );
  }
  
  /**
   * Batch API requests
   */
  async batchRequests(requests: APIRequest[]): Promise<any> {
    const response = await apiClient.post('/api/batch', { requests });
    return response.data;
  }
}

/**
 * Custom hook for paginated data with infinite scroll
 */
export function usePaginatedData<T = any>(endpoint: string, pageSize = 20) {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse<T>>(endpoint, {
        params: { page, limit: pageSize }
      });
      const newData = response.data;
      
      setData((prev: T[]) => [...prev, ...newData.items]);
      setHasMore(newData.hasMore);
      setPage((prev: number) => prev + 1);
    } finally {
      setLoading(false);
    }
  }, [page, hasMore, loading, endpoint, pageSize]);
  
  return { data, loadMore, hasMore, loading };
}

export const apiOptimizer = new APIOptimizer();
