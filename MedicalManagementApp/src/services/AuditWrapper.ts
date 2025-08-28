import { auditLog } from '../core/compliance/AuditLog';
import { sessionManager } from './SessionManager';
import DeviceInfo from 'react-native-device-info';

export interface DetailedAuditEntry {
  action: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  timestamp: string;
  dataIntegrityCheck: string;
  encryptionStatus: 'ENCRYPTED' | 'DECRYPTED';
  accessLevel: 'READ' | 'WRITE' | 'DELETE';
  dataAccessed: string[];
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  patientId?: string;
  ipAddress?: string;
  accessJustification?: string;
}

class AuditWrapper {
  private static instance: AuditWrapper;
  
  private constructor() {}
  
  static getInstance(): AuditWrapper {
    if (!AuditWrapper.instance) {
      AuditWrapper.instance = new AuditWrapper();
    }
    return AuditWrapper.instance;
  }
  
  /**
   * Log detailed audit entry while maintaining compatibility with base AuditLog
   */
  async logDetailed(entry: DetailedAuditEntry): Promise<void> {
    const sessionId = await sessionManager.getSessionId();
    const deviceId = await this.getDeviceId();
    
    // Map to base AuditLog format
    await auditLog.log({
      action: this.mapAction(entry.action),
      userId: entry.userId,
      patientId: entry.patientId,
      resourceType: this.mapResourceType(entry.dataAccessed),
      resourceId: entry.dataAccessed[0], // First accessed resource as ID
      timestamp: Date.now(), // Convert to number timestamp
      deviceId: entry.deviceId || deviceId || 'UNKNOWN',
      sessionId: entry.sessionId || sessionId || 'NO_SESSION',
      ipAddress: entry.ipAddress,
      purpose: this.mapPurpose(entry.accessLevel),
      authMethod: 'biometric',
      metadata: {
        // Store all the detailed tracking info in metadata
        dataIntegrityCheck: entry.dataIntegrityCheck,
        encryptionStatus: entry.encryptionStatus,
        accessLevel: entry.accessLevel,
        dataAccessed: entry.dataAccessed,
        result: entry.result,
        accessJustification: entry.accessJustification,
        originalAction: entry.action, // Preserve original action string
        timestamp: entry.timestamp // Preserve original timestamp format
      }
    });
  }
  
  /**
   * Log security-specific events
   */
  async logSecurity(event: {
    action: string;
    userId?: string;
    severity?: string;
    details?: any;
  }): Promise<void> {
    const sessionId = await sessionManager.getSessionId();
    const deviceId = await this.getDeviceId();
    const userId = event.userId || await sessionManager.getCurrentUserId();
    
    await this.logDetailed({
      action: event.action,
      userId: userId || 'SYSTEM',
      deviceId: deviceId || 'UNKNOWN',
      sessionId: sessionId || 'NO_SESSION',
      timestamp: new Date().toISOString(),
      dataIntegrityCheck: 'N/A',
      encryptionStatus: 'ENCRYPTED',
      accessLevel: 'READ',
      dataAccessed: [event.action],
      result: 'SUCCESS',
      accessJustification: JSON.stringify(event.details || {})
    });
  }
  
  private mapAction(action: string): any {
    // Map custom actions to base AuditAction types
    const actionMap: Record<string, string> = {
      'RATE_LIMIT_EXCEEDED': 'ERROR',
      'CERTIFICATE_VALIDATION_FAILED': 'ERROR',
      'CERTIFICATE_NOT_CONFIGURED': 'ERROR',
      'SESSION_INVALID_ACCESS_ATTEMPT': 'FAILED_AUTH',
      'INSECURE_CONNECTION_BLOCKED': 'ERROR',
      'APP_BACKGROUNDED_MEMORY_CLEARED': 'LOGOUT',
      'APP_FOREGROUNDED_REINITIALIZED': 'LOGIN',
      'API_DATA_ACCESS': 'VIEW',
      'API_ACCESS_ERROR': 'ERROR',
      'CACHE_ACCESS': 'VIEW',
      'CACHE_CLEARED': 'SETTINGS',
      'DATA_VALIDATION_FAILURE': 'ERROR',
      'VERSION_CONFLICT': 'ERROR'
    };
    
    return actionMap[action] || 'VIEW';
  }
  
  private mapResourceType(dataAccessed: string[]): any {
    if (!dataAccessed || dataAccessed.length === 0) {
      return 'AUDIT_LOG';
    }
    
    const firstAccess = dataAccessed[0].toLowerCase();
    
    if (firstAccess.includes('medication') || firstAccess.includes('prescription')) {
      return 'PRESCRIPTION';
    }
    if (firstAccess.includes('allergy')) {
      return 'ALLERGY';
    }
    if (firstAccess.includes('patient')) {
      return 'DEMOGRAPHICS';
    }
    if (firstAccess.includes('mental')) {
      return 'MENTAL_HEALTH';
    }
    if (firstAccess.includes('substance')) {
      return 'SUBSTANCE_ABUSE';
    }
    if (firstAccess.includes('lab')) {
      return 'LAB_RESULTS';
    }
    
    return 'AUDIT_LOG';
  }
  
  private mapPurpose(accessLevel: string): any {
    switch (accessLevel) {
      case 'WRITE':
      case 'DELETE':
        return 'OPERATIONS';
      case 'READ':
      default:
        return 'TREATMENT';
    }
  }
  
  private async getDeviceId(): Promise<string> {
    try {
      return await DeviceInfo.getUniqueId();
    } catch {
      return 'UNKNOWN_DEVICE';
    }
  }
}

export const auditWrapper = AuditWrapper.getInstance();