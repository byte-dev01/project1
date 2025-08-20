import SQLite from 'react-native-sqlite-storage';
import NetInfo from '@react-native-community/netinfo';
import { generateHash } from '../utils/crypto';

export class LocalAuditService {
  private db: SQLite.SQLiteDatabase;
  private syncQueue: AuditEntry[] = [];
  private syncTimer: NodeJS.Timeout;
  
  constructor() {
    this.initDatabase();
    this.startSyncTimer();
  }
  
  /**
   * Initialize local SQLite database
   */
  async initDatabase() {
    this.db = await SQLite.openDatabase({
      name: 'audit_local.db',
      location: 'default'
    });
    
    // Create local audit table (simpler than server)
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS audit_log_local (
        client_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        data TEXT NOT NULL,        -- JSON string of full entry
        hash TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_synced ON audit_log_local(synced);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_log_local(timestamp);
    `);
  }
  
  /**
   * Log locally first (instant, works offline)
   */
  async logLocal(entry: AuditEntry): Promise<void> {
    const clientId = `${entry.deviceId}_${Date.now()}_${Math.random()}`;
    const hash = generateHash(entry);
    
    const fullEntry = {
      ...entry,
      clientId,
      hash,
      timestamp: Date.now()
    };
    
    // Store in SQLite
    await this.db.executeSql(
      `INSERT INTO audit_log_local (client_id, timestamp, user_id, action, resource_type, data, hash, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        clientId,
        fullEntry.timestamp,
        entry.userId,
        entry.action,
        entry.resourceType,
        JSON.stringify(fullEntry),
        hash
      ]
    );
    
    // Add to sync queue
    this.syncQueue.push(fullEntry);
  }
  
  /**
   * Sync to server (Prisma backend)
   */
  async syncToServer(): Promise<void> {
    // Check network
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return; // Try again later
    }
    
    // Get unsynced entries
    const unsynced = await this.db.executeSql(
      `SELECT data FROM audit_log_local WHERE synced = 0 LIMIT 100`
    );
    
    if (unsynced[0].rows.length === 0) {
      return; // Nothing to sync
    }
    
    // Prepare batch
    const batch = [];
    for (let i = 0; i < unsynced[0].rows.length; i++) {
      const row = unsynced[0].rows.item(i);
      batch.push(JSON.parse(row.data));
    }
    
    try {
      // Send to Prisma backend
      const response = await fetch('https://your-api.com/audit/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ entries: batch })
      });
      
      if (response.ok) {
        // Mark as synced
        const clientIds = batch.map(e => e.clientId);
        await this.db.executeSql(
          `UPDATE audit_log_local SET synced = 1 WHERE client_id IN (${clientIds.map(() => '?').join(',')})`,
          clientIds
        );
        
        // Clear from queue
        this.syncQueue = this.syncQueue.filter(e => !clientIds.includes(e.clientId));
      }
    } catch (error) {
      console.error('Sync failed:', error);
      // Will retry on next timer
    }
  }
  
  /**
   * Start automatic sync timer
   */
  startSyncTimer() {
    // Sync every 30 seconds
    this.syncTimer = setInterval(() => {
      this.syncToServer();
    }, 30000);
    
    // Also sync on app foreground
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.syncToServer();
      }
    });
  }
  
  /**
   * Clean old synced entries (keep last 7 days locally)
   */
  async cleanOldEntries() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    await this.db.executeSql(
      `DELETE FROM audit_log_local 
       WHERE synced = 1 AND timestamp < ?`,
      [sevenDaysAgo]
    );
  }
}

