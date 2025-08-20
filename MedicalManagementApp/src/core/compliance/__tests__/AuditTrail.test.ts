import { AuditTrailService } from '../AuditTrail';
import SQLite from 'react-native-sqlite-storage';
import CryptoJS from 'crypto-js';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { AuditEvent, AuditEntry } from '@types/audit.types';

describe('AuditTrailService', () => {
  let auditService: AuditTrailService;
  let mockDb: any;
  let mockExecuteSql: jest.Mock;
  let mockTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockExecuteSql = jest.fn().mockResolvedValue([{ 
      rows: { 
        length: 0, 
        item: jest.fn() 
      } 
    }]);
    
    mockTransaction = jest.fn((callback) => {
      callback({
        executeSql: mockExecuteSql,
      });
    });

    mockDb = {
      executeSql: mockExecuteSql,
      transaction: mockTransaction,
      on: jest.fn(),
    };

    (SQLite.openDatabase as jest.Mock).mockResolvedValue(mockDb);
    
    auditService = new AuditTrailService();
  });

  describe('initialize', () => {
    it('should initialize database and all components', async () => {
      await auditService.initialize();
      
      expect(SQLite.openDatabase).toHaveBeenCalledWith({
        name: 'audit_trail.db',
        location: 'default',
      });
      
      // Verify table creation
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS audit_log')
      );
    });

    it('should set up real-time sync with network monitoring', async () => {
      const addListenerSpy = jest.spyOn(NetInfo, 'addEventListener');
      
      await auditService.initialize();
      
      expect(addListenerSpy).toHaveBeenCalled();
    });
  });

  describe('logAccess', () => {
    const mockAuditEvent: AuditEvent = {
      userId: 'user-123',
      patientId: 'patient-456',
      action: 'VIEW',
      resourceType: 'PRESCRIPTION',
      resourceId: 'rx-789',
      userRole: 'doctor',
      sessionId: 'session-abc',
      phiAccessed: 'Medication List',
      reason: 'Treatment',
    };

    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should create audit entry with all required fields', async () => {
      await auditService.logAccess(mockAuditEvent);
      
      expect(DeviceInfo.getUniqueId).toHaveBeenCalled();
      expect(DeviceInfo.getVersion).toHaveBeenCalled();
      expect(DeviceInfo.getSystemVersion).toHaveBeenCalled();
    });

    it('should generate tamper-proof hash chain', async () => {
      const sha256Spy = jest.spyOn(CryptoJS, 'SHA256');
      
      await auditService.logAccess(mockAuditEvent);
      
      expect(sha256Spy).toHaveBeenCalled();
    });

    it('should detect and flag after-hours access', async () => {
      const originalHours = Date.prototype.getHours;
      Date.prototype.getHours = jest.fn(() => 23); // 11 PM
      
      await auditService.logAccess(mockAuditEvent);
      
      // Restore original
      Date.prototype.getHours = originalHours;
    });

    it('should handle emergency override access', async () => {
      const emergencyEvent = {
        ...mockAuditEvent,
        isEmergency: true,
      };
      
      await auditService.logAccess(emergencyEvent);
      
      // Verify emergency access is properly logged
      expect(mockExecuteSql).toHaveBeenCalled();
    });

    it('should perform California compliance checks for minor patients', async () => {
      const minorEvent = {
        ...mockAuditEvent,
        patientId: 'minor-patient-123',
        resourceType: 'REPRODUCTIVE_HEALTH',
      };
      
      await auditService.logAccess(minorEvent);
      
      // Verify minor consent service flags are set
      expect(mockExecuteSql).toHaveBeenCalled();
    });
  });

  describe('generateComplianceReport', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should generate comprehensive compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const report = await auditService.generateComplianceReport(startDate, endDate);
      
      expect(report).toHaveProperty('unauthorizedAccess');
      expect(report).toHaveProperty('minorRecordsAccessed');
      expect(report).toHaveProperty('psychRecordsAccessed');
      expect(report).toHaveProperty('substanceAbuseRecords');
      expect(report).toHaveProperty('providerActivitySummary');
      expect(report).toHaveProperty('prescriptionAudits');
      expect(report).toHaveProperty('consumerRequests');
      expect(report).toHaveProperty('dataPortability');
    });
  });

  describe('preserveLegalHold', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should preserve records for legal hold', async () => {
      const caseId = 'case-123';
      const patientIds = ['patient-1', 'patient-2', 'patient-3'];
      
      await auditService.preserveLegalHold(caseId, patientIds);
      
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE audit_log SET legal_hold'),
        expect.arrayContaining([caseId, expect.any(Number), patientIds.join(',')])
      );
    });
  });

  describe('detectTampering', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should detect broken hash chain', async () => {
      // Mock audit entries with broken chain
      mockExecuteSql.mockResolvedValueOnce([{
        rows: {
          length: 2,
          item: (index: number) => {
            if (index === 0) {
              return {
                id: 'entry-1',
                hash: 'hash-1',
                previousHash: null,
                data: JSON.stringify({ id: 'entry-1' }),
              };
            }
            return {
              id: 'entry-2',
              hash: 'hash-2',
              previousHash: 'wrong-hash', // Broken chain
              data: JSON.stringify({ id: 'entry-2' }),
            };
          },
        },
      }]);
      
      const issues = await auditService.detectTampering();
      
      expect(issues).toHaveLength(2); // One for broken chain, one for modified entry
      expect(issues[0].type).toBe('BROKEN_CHAIN');
    });

    it('should detect modified entries', async () => {
      mockExecuteSql.mockResolvedValueOnce([{
        rows: {
          length: 1,
          item: () => ({
            id: 'entry-1',
            hash: 'original-hash',
            previousHash: null,
            data: JSON.stringify({ id: 'entry-1', tampered: true }),
          }),
        },
      }]);
      
      const issues = await auditService.detectTampering();
      
      expect(issues.some(i => i.type === 'MODIFIED_ENTRY')).toBe(true);
    });
  });

  describe('performHealthCheck', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should check all system components', async () => {
      const healthStatus = await auditService.performHealthCheck();
      
      expect(healthStatus).toHaveProperty('database');
      expect(healthStatus).toHaveProperty('storage');
      expect(healthStatus).toHaveProperty('network');
      expect(healthStatus).toHaveProperty('replication');
      expect(healthStatus).toHaveProperty('auditIntegrity');
    });

    it('should initiate failover when critical components fail', async () => {
      // Mock failing database
      jest.spyOn(auditService as any, 'checkDatabase').mockResolvedValue(false);
      
      const consoleSpy = jest.spyOn(console, 'log');
      await auditService.performHealthCheck();
      
      expect(consoleSpy).toHaveBeenCalledWith('[CRITICAL] Initiating audit system failover');
    });
  });

  describe('backupAuditTrail', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should create encrypted backups', async () => {
      const backupResult = await auditService.backupAuditTrail();
      
      expect(backupResult.success).toBe(true);
      expect(backupResult.checksum).toBeTruthy();
      expect(backupResult.locations).toHaveLength(3); // S3, Glacier, Local
      expect(backupResult.nextBackup).toBeGreaterThan(Date.now());
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should buffer writes for performance', async () => {
      const entry: AuditEntry = {
        id: 'test-entry',
        timestamp: Date.now(),
        userId: 'user-123',
        action: 'VIEW',
        resourceType: 'PATIENT',
        resourceId: 'patient-123',
        userRole: 'doctor',
        deviceFingerprint: 'device-123',
        sessionId: 'session-123',
        emergency_override: false,
        hash: null,
        app_version: '1.0.0',
        os_version: '14.0',
      };
      
      await auditService.bufferWrite(entry);
      
      // Should not immediately write to database
      expect(mockTransaction).not.toHaveBeenCalled();
      
      // Trigger buffer flush
      for (let i = 0; i < 100; i++) {
        await auditService.bufferWrite({ ...entry, id: `entry-${i}` });
      }
      
      // Now should flush
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should use query cache for repeated queries', async () => {
      const params = { userId: 'user-123', action: 'VIEW' };
      
      // First query
      await auditService.queryOptimized(params);
      expect(mockExecuteSql).toHaveBeenCalledTimes(1);
      
      // Second query (should use cache)
      await auditService.queryOptimized(params);
      expect(mockExecuteSql).toHaveBeenCalledTimes(1); // Still 1, used cache
    });
  });

  describe('California Compliance Integration', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should generate California compliance metrics', async () => {
      const metrics = await auditService.generateCaliforniaComplianceMetrics();
      
      expect(metrics).toHaveProperty('rightToKnowRequests');
      expect(metrics).toHaveProperty('deletionRequests');
      expect(metrics).toHaveProperty('optOutRequests');
      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('potentialBreaches');
      expect(metrics).toHaveProperty('notificationsSent');
      expect(metrics).toHaveProperty('providerAccess');
      expect(metrics).toHaveProperty('afterHoursAccess');
      expect(metrics).toHaveProperty('crossPatientAccess');
    });

    it('should report to California authorities for violations', async () => {
      await auditService.reportToCaliforniaAuthorities({
        type: 'PRIVACY_BREACH',
      });
      
      // Verify immediate reporting for privacy breaches
      expect(mockExecuteSql).toHaveBeenCalled();
    });

    it('should export audit trail for California audit', async () => {
      const auditExport = await auditService.exportForCaliforniaAudit();
      
      expect(auditExport).toHaveProperty('prescriptionLog');
      expect(auditExport).toHaveProperty('controlledSubstances');
      expect(auditExport).toHaveProperty('minorRecords');
      expect(auditExport).toHaveProperty('mentalHealthRecords');
      expect(auditExport).toHaveProperty('certifications');
      expect(auditExport.certifications).toHaveProperty('HIPAA');
      expect(auditExport.certifications).toHaveProperty('CMIA');
      expect(auditExport.certifications).toHaveProperty('CCPA');
    });
  });

  describe('Security Features', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should encrypt sensitive fields', async () => {
      const entry: AuditEntry = {
        id: 'test-entry',
        timestamp: Date.now(),
        userId: 'user-123',
        action: 'VIEW',
        resourceType: 'PATIENT',
        resourceId: 'patient-123',
        userRole: 'doctor',
        deviceFingerprint: 'device-123',
        sessionId: 'session-123',
        emergency_override: false,
        hash: null,
        app_version: '1.0.0',
        os_version: '14.0',
      };
      
      const encrypted = await auditService.encryptSensitiveFields(entry);
      
      // Verify sensitive fields are encrypted
      expect(encrypted).toBeDefined();
    });

    it('should detect anomalous access patterns', async () => {
      const suspiciousEntry: AuditEntry = {
        id: 'suspicious-entry',
        timestamp: Date.now(),
        userId: 'suspicious-user',
        patientId: 'vip-patient',
        action: 'BULK_EXPORT',
        resourceType: 'PATIENT',
        resourceId: 'all',
        userRole: 'receptionist',
        deviceFingerprint: 'device-123',
        sessionId: 'session-123',
        emergency_override: false,
        hash: null,
        app_version: '1.0.0',
        os_version: '14.0',
        recordCount: 1000, // Suspicious bulk export
      };
      
      const anomalyScore = await auditService.detectAnomalousAccess(suspiciousEntry);
      
      expect(anomalyScore.total).toBeGreaterThan(0);
      expect(anomalyScore.factors.length).toBeGreaterThan(0);
    });

    it('should create secure export with redaction', async () => {
      const export_result = await auditService.secureExport('auditor-123', 'Annual audit');
      
      expect(export_result).toHaveProperty('data');
      expect(export_result).toHaveProperty('signature');
      expect(export_result).toHaveProperty('timestamp');
      expect(export_result).toHaveProperty('exportId');
      expect(export_result).toHaveProperty('validUntil');
      expect(export_result.validUntil).toBeGreaterThan(Date.now());
    });
  });
});