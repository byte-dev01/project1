import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { STORAGE_KEYS } from './constants';



class OfflineManager {
  private syncQueue = new Queue();
  private criticalDataCache = new Map();
  
  async initialize() {
    // Monitor network status
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.syncPendingChanges();
      }
    });
    
    // Preload critical data for current patient
    await this.preloadCriticalData();
  }
  
  /**
   * Cache critical patient data for offline access
   */
  async cachePatientData(patientId: string) {
    const criticalData = {
      demographics: await this.fetchAndCache(`/patients/${patientId}`),
      allergies: await this.fetchAndCache(`/patients/${patientId}/allergies`),
      medications: await this.fetchAndCache(`/patients/${patientId}/medications`),
      problems: await this.fetchAndCache(`/patients/${patientId}/problems`),
      recentLabs: await this.fetchAndCache(`/patients/${patientId}/labs?limit=10`),
      recentVitals: await this.fetchAndCache(`/patients/${patientId}/vitals?limit=5`),
      insurances: await this.fetchAndCache(`/patients/${patientId}/insurance`),
    };
    
    // Encrypt and store
    const encrypted = await this.encryptData(criticalData);
    await AsyncStorage.setItem(`patient_${patientId}`, encrypted);
    
    return criticalData;
  }
  
  /**
   * Queue actions for sync when online
   */
  async queueAction(action: any) {
    const queueItem = {
      id: generateUUID(),
      action,
      timestamp: Date.now(),
      retries: 0,
    };
    
    // Store in queue
    await this.syncQueue.addJob(queueItem);
    
    // Try immediate sync if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      await this.processSyncQueue();
    }
  }
  
  /**
   * Handle offline note-taking (critical for rounds)
   */
  async saveOfflineNote(note: ClinicalNote) {
    // Save locally first
    await this.saveLocal('notes', note);
    
    // Queue for sync
    await this.queueAction({
      type: 'CREATE_NOTE',
      data: note,
      endpoint: '/clinical-notes',
      method: 'POST',
    });
    
    // Mark as pending sync in UI
    return { ...note, syncStatus: 'pending' };
  }
}



interface SyncQueueItem {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: any;
  timestamp: number;
  retryCount: number;
}

interface CachedData {
  data: any;
  timestamp: number;
  expiresAt?: number;
}

class OfflineManager {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private listeners: ((isOnline: boolean) => void)[] = [];

  constructor() {
    this.initializeNetworkListener();
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      this.notifyListeners(this.isOnline);
      
      if (this.isOnline && !this.syncInProgress) {
        this.processSyncQueue();
      }
    });
  }

  // Network status
  async checkConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  getConnectionStatus(): boolean {
    return this.isOnline;
  }

  addConnectionListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline));
  }

  // Cache management
  async cacheData(key: string, data: any, ttl?: number): Promise<void> {
    const cacheItem: CachedData = {
      data,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };

    await AsyncStorage.setItem(
      `${STORAGE_KEYS.CACHED_DATA}_${key}`,
      JSON.stringify(cacheItem)
    );
  }

  async getCachedData<T = any>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.CACHED_DATA}_${key}`);
      if (!cached) return null;

      const cacheItem: CachedData = JSON.parse(cached);
      
      // Check if expired
      if (cacheItem.expiresAt && Date.now() > cacheItem.expiresAt) {
        await this.removeCachedData(key);
        return null;
      }

      return cacheItem.data as T;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async removeCachedData(key: string): Promise<void> {
    await AsyncStorage.removeItem(`${STORAGE_KEYS.CACHED_DATA}_${key}`);
  }

  async clearAllCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.CACHED_DATA));
    await AsyncStorage.multiRemove(cacheKeys);
  }

  // Sync queue management
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queue = await this.getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: this.generateQueueItemId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    queue.push(newItem);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  }

  private async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const queue = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    const queue = await this.getSyncQueue();
    const failedItems: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        // Import api dynamically to avoid circular dependency
        const { api } = await import('../src/api/client');
        await api.request({
          method: item.method,
          url: item.endpoint,
          data: item.data,
        });
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        item.retryCount++;
        
        // Keep items that haven't exceeded max retries
        if (item.retryCount < 3) {
          failedItems.push(item);
        }
      }
    }

    // Update queue with failed items
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(failedItems));
    this.syncInProgress = false;
  }

  async clearSyncQueue(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  }

  private generateQueueItemId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Offline-first data strategies
  async fetchWithCache<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      ttl?: number;
      forceRefresh?: boolean;
      offlineFallback?: T;
    } = {}
  ): Promise<T> {
    const { ttl = 3600000, forceRefresh = false, offlineFallback } = options;

    // Try cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = await this.getCachedData<T>(key);
      if (cached !== null) {
        // Refresh in background if online
        if (this.isOnline) {
          this.refreshInBackground(key, fetcher, ttl);
        }
        return cached;
      }
    }

    // If online, fetch fresh data
    if (this.isOnline) {
      try {
        const data = await fetcher();
        await this.cacheData(key, data, ttl);
        return data;
      } catch (error) {
        // Fall back to cache on error
        const cached = await this.getCachedData<T>(key);
        if (cached !== null) return cached;
        
        // Use offline fallback if provided
        if (offlineFallback !== undefined) return offlineFallback;
        
        throw error;
      }
    }

    // Offline: try cache
    const cached = await this.getCachedData<T>(key);
    if (cached !== null) return cached;

    // Use offline fallback if provided
    if (offlineFallback !== undefined) return offlineFallback;

    throw new Error('No data available offline');
  }

  private async refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      const data = await fetcher();
      await this.cacheData(key, data, ttl);
    } catch (error) {
      console.log('Background refresh failed:', error);
    }
  }
}

export const offlineManager = new OfflineManager();
