
class APIOptimizer {
  private requestCache = new Map();
  private pendingRequests = new Map();
  
  /**
   * Implement request deduplication
   */
  async fetchWithDedup(url: string, options = {}) {
    const key = `${url}_${JSON.stringify(options)}`;
    
    // Return pending request if exists
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // Check cache
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 min cache
      return cached.data;
    }
    
    // Make request
    const promise = fetch(url, options)
      .then(res => res.json())
      .then(data => {
        this.requestCache.set(key, { data, timestamp: Date.now() });
        this.pendingRequests.delete(key);
        return data;
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
  
  /**
   * Batch API requests
   */
  async batchRequests(requests: APIRequest[]) {
    const response = await fetch('/api/batch', {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
    
    return response.json();
  }
  
  /**
   * Implement pagination with infinite scroll
   */
  usePaginatedData(endpoint: string, pageSize = 20) {
    const [data, setData] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    
    const loadMore = useCallback(async () => {
      if (loading || !hasMore) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${endpoint}?page=${page}&limit=${pageSize}`);
        const newData = await response.json();
        
        setData(prev => [...prev, ...newData.items]);
        setHasMore(newData.hasMore);
        setPage(prev => prev + 1);
      } finally {
        setLoading(false);
      }
    }, [page, hasMore, loading]);
    
    return { data, loadMore, hasMore, loading };
  }
}
