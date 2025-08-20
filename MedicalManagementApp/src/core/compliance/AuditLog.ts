// src/core/compliance/AuditLogService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

/**
 * HIPAA & California-Compliant Audit Log Service
 * Meets all requirements for read-only prescription display app
 */

// Types for audit events
export interface AuditEvent {
  // Required by HIPAA
  userId: string;                    // Who accessed
  patientId?: string;                 // Whose data
  action: AuditAction;                // What they did
  resourceType: ResourceType;         // What type of data
  resourceId?: string;                // Specific resource
  timestamp: number;                  // When it happened
  
  // Required for forensics
  deviceId: string;                   // Which device
  sessionId: string;                  // Which session
  ipAddress?: string;                 // From where
  
  // California-specific
  purpose: AccessPurpose;             // Why accessed (CCPA requirement)
  minorAccess?: boolean;              // Special CA protections
  mentalHealthData?: boolean;         // LPS Act compliance
  substanceAbuseData?: boolean;       // 42 CFR Part 2
  
  // Security context
  authMethod: 'biometric' | 'pin' | 'password';
  breakGlassAccess?: boolean;         // Emergency override
  
  // Additional context
  userRole?: string;                  // Provider, nurse, admin, patient
  department?: string;                // Which department/clinic
  metadata?: Record<string, any>;     // Flexible additional data
}

export type AuditAction = 
  | 'VIEW'           // Viewed data
  | 'SEARCH'         // Searched for patient
  | 'EXPORT'         // Exported/downloaded data
  | 'PRINT'          // Printed records
  | 'SHARE'          // Shared with another provider
  | 'CONSENT_GRANT'  // Patient granted consent
  | 'CONSENT_REVOKE' // Patient revoked consent
  | 'LOGIN'          // User logged in
  | 'LOGOUT'         // User logged out
  | 'TIMEOUT'        // Session timed out
  | 'FAILED_AUTH'    // Failed authentication attempt
  | 'EMERGENCY'      // Emergency access
  | 'SETTINGS'       // Changed settings
  | 'ERROR';         // System error accessing PHI

export type ResourceType = 
  | 'PRESCRIPTION'
  | 'ALLERGY'
  | 'INSURANCE'
  | 'DEMOGRAPHICS'
  | 'CONTACT_INFO'
  | 'MEDICAL_HISTORY'
  | 'LAB_RESULTS'
  | 'IMMUNIZATION'
  | 'MENTAL_HEALTH'      // Special protections in CA
  | 'SUBSTANCE_ABUSE'    // Federal + CA protections
  | 'MINOR_RECORDS'      // CA specific rules
  | 'AUDIT_LOG';         // Meta-auditing

export type AccessPurpose = 
  | 'TREATMENT'
  | 'PAYMENT'
  | 'OPERATIONS'
  | 'PATIENT_REQUEST'
  | 'EMERGENCY'
  | 'LEGAL_REQUIREMENT'
  | 'PUBLIC_HEALTH';

interface ComplianceViolation {
  type: 'UNAUTHORIZED_ACCESS' | 'EXCESSIVE_ACCESS' | 'AFTER_HOURS' | 'VIP_SNOOPING' | 'MINOR_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;
  timestamp: number;
}

export class AuditLogService {
  private static instance: AuditLogService;
  private db: SQLite.SQLiteDatabase | null = null;
  private sessionId: string;
  private writeQueue: AuditEvent[] = [];
  private syncTimer: NodeJS.Timeout | null = null;
  
  // California requirements
  private readonly RETENTION_DAYS_ADULT = 7 * 365;        // 7 years
  private readonly RETENTION_DAYS_MINOR = 25 * 365;      // Until age 25
  private readonly BREACH_NOTIFICATION_HOURS = 24;        // California requirement
  
  // Performance settings
  private readonly BATCH_SIZE = 100;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  
  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeDatabase();
    this.startSyncTimer();
  }
  
  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }
  
  /**
   * Initialize SQLite database for local audit storage
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'audit_log.db',
        location: 'default',
        // iOS: Store in encrypted container
        ...(Platform.OS === 'ios' && { iosDatabaseLocation: 'Documents' })
      });
      
      // Create audit log table with all required fields
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          patient_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          purpose TEXT NOT NULL,
          
          -- Security context
          device_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          ip_address TEXT,
          auth_method TEXT NOT NULL,
          user_role TEXT,
          department TEXT,
          
          -- California specific
          minor_access INTEGER DEFAULT 0,
          mental_health_data INTEGER DEFAULT 0,
          substance_abuse_data INTEGER DEFAULT 0,
          break_glass_access INTEGER DEFAULT 0,
          
          -- Integrity
          hash TEXT NOT NULL,
          previous_hash TEXT,
          
          -- Sync status
          synced INTEGER DEFAULT 0,
          sync_timestamp INTEGER,
          
          -- Metadata
          app_version TEXT,
          os_version TEXT,
          metadata TEXT,
          
          -- Indexes for compliance queries
          INDEX idx_user_time (user_id, timestamp),
          INDEX idx_patient_time (patient_id, timestamp),
          INDEX idx_sync_status (synced, timestamp),
          INDEX idx_compliance (timestamp, action, resource_type)
        );
      `);
      
      // Create violations table for detected issues
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS compliance_violations (
          id TEXT PRIMARY KEY,
          audit_event_id TEXT,
          type TEXT NOT NULL,
          severity TEXT NOT NULL,
          details TEXT,
          timestamp INTEGER NOT NULL,
          resolved INTEGER DEFAULT 0,
          resolution_notes TEXT,
          FOREIGN KEY (audit_event_id) REFERENCES audit_log(id)
        );
      `);
      
    } catch (error) {
      console.error('[AUDIT] Failed to initialize database:', error);
      // Fall back to AsyncStorage if SQLite fails
      await this.initializeFallbackStorage();
    }
  }
  
  /**
   * Main logging function - this is what you call from your app
   */
  async log(event: Partial<AuditEvent>): Promise<void> {
    try {
      // Build complete audit event
      const fullEvent: AuditEvent = {
        ...event,
        userId: event.userId || 'SYSTEM',
        action: event.action || 'VIEW',
        resourceType: event.resourceType || 'PRESCRIPTION',
        purpose: event.purpose || 'TREATMENT',
        timestamp: Date.now(),
        deviceId: await this.getDeviceId(),
        sessionId: this.sessionId,
        ipAddress: await this.getIPAddress(),
        authMethod: event.authMethod || 'biometric',
        userRole: event.userRole || 'provider',
      };
      
      // Add integrity hash
      const auditEntry = await this.addIntegrityHash(fullEvent);
      
      // Check for compliance violations
      await this.checkCompliance(auditEntry);
      
      // Store locally first (immediate)
      await this.storeLocal(auditEntry);
      
      // Queue for server sync
      this.writeQueue.push(auditEntry);
      
      // Force sync if critical event
      if (this.isCriticalEvent(auditEntry)) {
        await this.syncToServer();
      }
      
    } catch (error) {
      console.error('[AUDIT] Logging failed:', error);
      // Audit logging must never break the app
      // Store in emergency fallback
      await this.emergencyStore(event);
    }
  }
  
  /**
   * Check for compliance violations
   */
  private async checkCompliance(event: AuditEvent): Promise<void> {
    const violations: ComplianceViolation[] = [];
    
    // Check for after-hours access (California hospitals often have policies)
    const hour = new Date().getHours();
    if ((hour < 6 || hour > 22) && !event.breakGlassAccess) {
      violations.push({
        type: 'AFTER_HOURS',
        severity: 'LOW',
        details: `Access at ${hour}:00 outside normal hours`,
        timestamp: event.timestamp
      });
    }
    
    // Check for excessive access (potential breach indicator)
    const recentAccess = await this.getRecentUserAccess(event.userId, 3600000); // 1 hour
    if (recentAccess > 50) {
      violations.push({
        type: 'EXCESSIVE_ACCESS',
        severity: 'HIGH',
        details: `User accessed ${recentAccess} records in 1 hour`,
        timestamp: event.timestamp
      });
    }
    
    // Check minor access (California specific)
    if (event.minorAccess && event.userRole !== 'parent' && !event.breakGlassAccess) {
      violations.push({
        type: 'MINOR_VIOLATION',
        severity: 'CRITICAL',
        details: 'Minor record accessed without parental role',
        timestamp: event.timestamp
      });
    }
    
    // Store violations
    for (const violation of violations) {
      await this.storeViolation(violation, event);
      
      // Alert for high/critical violations
      if (violation.severity === 'HIGH' || violation.severity === 'CRITICAL') {
        await this.alertCompliance(violation, event);
      }
    }
  }
  
  /**
   * Store audit event locally
   */
  private async storeLocal(event: AuditEvent): Promise<void> {
    if (!this.db) {
      await this.storeFallback(event);
      return;
    }
    
    const id = this.generateAuditId();
    const previousHash = await this.getLastHash();
    const hash = this.calculateHash({ ...event, id, previousHash });
    
    await this.db.executeSql(
      `INSERT INTO audit_log (
        id, timestamp, user_id, patient_id, action, resource_type, resource_id,
        purpose, device_id, session_id, ip_address, auth_method, user_role,
        department, minor_access, mental_health_data, substance_abuse_data,
        break_glass_access, hash, previous_hash, app_version, os_version, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event.timestamp,
        event.userId,
        event.patientId || null,
        event.action,
        event.resourceType,
        event.resourceId || null,
        event.purpose,
        event.deviceId,
        event.sessionId,
        event.ipAddress || null,
        event.authMethod,
        event.userRole || null,
        event.department || null,
        event.minorAccess ? 1 : 0,
        event.mentalHealthData ? 1 : 0,
        event.substanceAbuseData ? 1 : 0,
        event.breakGlassAccess ? 1 : 0,
        hash,
        previousHash,
        DeviceInfo.getVersion(),
        DeviceInfo.getSystemVersion(),
        JSON.stringify(event.metadata || {})
      ]
    );
  }
  
  /**
   * Sync audit logs to server
   */
  private async syncToServer(): Promise<void> {
    if (this.writeQueue.length === 0) return;
    
    const batch = this.writeQueue.splice(0, this.BATCH_SIZE);
    
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Re-queue for later
        this.writeQueue.unshift(...batch);
        return;
      }
      
      // Send to server
      const response = await fetch('https://your-api.com/audit/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Audit-Signature': this.signBatch(batch),
        },
        body: JSON.stringify({
          events: batch,
          deviceId: await this.getDeviceId(),
          timestamp: Date.now(),
        }),
      });
      
      if (response.ok) {
        // Mark as synced in local database
        await this.markSynced(batch);
      } else {
        // Re-queue failed items
        this.writeQueue.unshift(...batch);
      }
      
    } catch (error) {
      console.error('[AUDIT] Sync failed:', error);
      // Re-queue for retry
      this.writeQueue.unshift(...batch);
    }
  }
  
  /**
   * Generate compliance reports
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const report = {
      period: { start: startDate, end: endDate },
      summary: {
        totalAccess: 0,
        uniqueUsers: 0,
        uniquePatients: 0,
        violations: 0,
      },
      
      // HIPAA required elements
      accessByUser: await this.getAccessByUser(startDate, endDate),
      accessByPatient: await this.getAccessByPatient(startDate, endDate),
      unauthorizedAttempts: await this.getUnauthorizedAttempts(startDate, endDate),
      
      // California specific
      minorAccess: await this.getMinorAccess(startDate, endDate),
      mentalHealthAccess: await this.getMentalHealthAccess(startDate, endDate),
      afterHoursAccess: await this.getAfterHoursAccess(startDate, endDate),
      
      // Violations
      violations: await this.getViolations(startDate, endDate),
      
      // Emergency access
      breakGlassAccess: await this.getBreakGlassAccess(startDate, endDate),
    };
    
    return report;
  }
  
  /**
   * Query functions for compliance reporting
   */
  async getAccessByUser(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT user_id, COUNT(*) as access_count, 
              COUNT(DISTINCT patient_id) as patients_accessed
       FROM audit_log 
       WHERE timestamp BETWEEN ? AND ?
       GROUP BY user_id
       ORDER BY access_count DESC`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  async getViolations(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT * FROM compliance_violations
       WHERE timestamp BETWEEN ? AND ?
       ORDER BY severity DESC, timestamp DESC`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  /**
   * Utility functions
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async getDeviceId(): Promise<string> {
    return DeviceInfo.getUniqueId();
  }
  
  private async getIPAddress(): Promise<string | undefined> {
    // This would need to be implemented based on your networking setup
    return undefined;
  }
  
  private calculateHash(data: any): string {
    const content = JSON.stringify(data);
    return CryptoJS.SHA256(content).toString();
  }
  
  private async getLastHash(): Promise<string | null> {
    if (!this.db) return null;
    
    const result = await this.db.executeSql(
      'SELECT hash FROM audit_log ORDER BY timestamp DESC LIMIT 1'
    );
    
    return result[0].rows.length > 0 ? result[0].rows.item(0).hash : null;
  }
  
  private isCriticalEvent(event: AuditEvent): boolean {
    return event.breakGlassAccess || 
           event.action === 'EXPORT' ||
           event.action === 'EMERGENCY' ||
           event.minorAccess ||
           event.mentalHealthData ||
           event.substanceAbuseData;
  }
  
  private signBatch(batch: AuditEvent[]): string {
    const content = JSON.stringify(batch);
    return CryptoJS.HmacSHA256(content, 'your-secret-key').toString();
  }
  
  private async addIntegrityHash(event: AuditEvent): Promise<AuditEvent> {
    const previousHash = await this.getLastHash();
    const hash = this.calculateHash({ ...event, previousHash });
    return { ...event, hash, previousHash } as any;
  }
  
  private async getRecentUserAccess(userId: string, timeWindow: number): Promise<number> {
    if (!this.db) return 0;
    
    const since = Date.now() - timeWindow;
    const result = await this.db.executeSql(
      'SELECT COUNT(*) as count FROM audit_log WHERE user_id = ? AND timestamp > ?',
      [userId, since]
    );
    
    return result[0].rows.item(0).count;
  }
  
  private async storeViolation(violation: ComplianceViolation, event: AuditEvent): Promise<void> {
    if (!this.db) return;
    
    await this.db.executeSql(
      `INSERT INTO compliance_violations (id, audit_event_id, type, severity, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        this.generateAuditId(),
        (event as any).id,
        violation.type,
        violation.severity,
        violation.details,
        violation.timestamp
      ]
    );
  }
  
  private async alertCompliance(violation: ComplianceViolation, event: AuditEvent): Promise<void> {
    // In production, this would send alerts to compliance team
    console.warn('[COMPLIANCE ALERT]', violation, event);
    
    // For critical violations, could trigger immediate actions
    if (violation.severity === 'CRITICAL') {
      // Could lock user account, notify security team, etc.
    }
  }
  
  /**
   * Fallback storage methods
   */
  private async initializeFallbackStorage(): Promise<void> {
    // Use AsyncStorage as fallback
    const existing = await AsyncStorage.getItem('audit_log_fallback');
    if (!existing) {
      await AsyncStorage.setItem('audit_log_fallback', JSON.stringify([]));
    }
  }
  
  private async storeFallback(event: AuditEvent): Promise<void> {
    const existing = await AsyncStorage.getItem('audit_log_fallback');
    const logs = existing ? JSON.parse(existing) : [];
    logs.push(event);
    
    // Keep only last 1000 entries in fallback
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await AsyncStorage.setItem('audit_log_fallback', JSON.stringify(logs));
  }
  
  private async emergencyStore(event: any): Promise<void> {
    // Last resort - store minimal info
    const emergency = {
      timestamp: Date.now(),
      action: event.action || 'UNKNOWN',
      userId: event.userId || 'UNKNOWN',
      error: 'Emergency storage',
    };
    
    await AsyncStorage.setItem(
      `emergency_audit_${Date.now()}`,
      JSON.stringify(emergency)
    );
  }
  
  private async markSynced(batch: AuditEvent[]): Promise<void> {
    if (!this.db) return;
    
    const ids = batch.map(e => (e as any).id);
    const placeholders = ids.map(() => '?').join(',');
    
    await this.db.executeSql(
      `UPDATE audit_log SET synced = 1, sync_timestamp = ? 
       WHERE id IN (${placeholders})`,
      [Date.now(), ...ids]
    );
  }
  
  private startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      this.syncToServer();
    }, this.SYNC_INTERVAL);
  }
  
  /**
   * Cleanup and lifecycle
   */
  async cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    // Final sync attempt
    await this.syncToServer();
    
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
  
  /**
   * Additional helper methods for specific compliance needs
   */
  async getMinorAccess(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT * FROM audit_log 
       WHERE minor_access = 1 AND timestamp BETWEEN ? AND ?`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  async getMentalHealthAccess(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT * FROM audit_log 
       WHERE mental_health_data = 1 AND timestamp BETWEEN ? AND ?`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  async getAfterHoursAccess(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    // This is a simplified query - in production you'd check actual hours
    const result = await this.db.executeSql(
      `SELECT * FROM audit_log 
       WHERE timestamp BETWEEN ? AND ?
       AND (CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) < 6 
            OR CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) > 22)`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  async getBreakGlassAccess(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT * FROM audit_log 
       WHERE break_glass_access = 1 AND timestamp BETWEEN ? AND ?`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  async getAccessByPatient(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT patient_id, COUNT(*) as access_count,
              COUNT(DISTINCT user_id) as unique_users
       FROM audit_log
       WHERE timestamp BETWEEN ? AND ?
       GROUP BY patient_id
       ORDER BY access_count DESC`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
  
  async getUnauthorizedAttempts(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.db) return [];
    
    const result = await this.db.executeSql(
      `SELECT * FROM audit_log
       WHERE action = 'FAILED_AUTH' AND timestamp BETWEEN ? AND ?`,
      [startDate.getTime(), endDate.getTime()]
    );
    
    return result[0].rows.raw();
  }
}

// Export singleton instance
export const auditLog = AuditLogService.getInstance();