export interface AuditEvent {
  userId: string;
  patientId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userRole: string;
  sessionId: string;
  phiAccessed?: string;
  reason?: string;
  isEmergency?: boolean;
  ipAddress?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  patientId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userRole: string;
  accessLocation?: string;
  deviceFingerprint: string;
  sessionId: string;
  phi_accessed?: string;
  access_reason?: string;
  emergency_override: boolean;
  hash: string | null;
  previousHash?: string;
  ip_address?: string;
  app_version: string;
  os_version: string;
  flags?: string[];
  requiresSpecialAuth?: boolean;
  minorConsentService?: boolean;
  parentalAccessBlocked?: boolean;
  retentionDate?: number;
  accessType?: string;
  telehealthCompliance?: any;
  recordCount?: number;
  priority?: string;
}

export interface Report {
  unauthorizedAccess: any[];
  minorRecordsAccessed: any[];
  psychRecordsAccessed: any[];
  substanceAbuseRecords: any[];
  providerActivitySummary: any[];
  prescriptionAudits: any[];
  consumerRequests: any[];
  dataPortability: any[];
}

export interface CAMetrics {
  rightToKnowRequests: number;
  deletionRequests: number;
  optOutRequests: number;
  avgResponseTime: number;
  potentialBreaches: any[];
  notificationsSent: any[];
  providerAccess: any[];
  afterHoursAccess: any[];
  crossPatientAccess: any[];
}

export interface ComplianceViolation {
  type: 'PRIVACY_BREACH' | 'MINOR_PRIVACY' | 'CONTROLLED_SUBSTANCE' | 'MEDICARE_FRAUD';
}

export interface AuditExport {
  period: any;
  prescriptionLog: any[];
  controlledSubstances: any[];
  minorRecords: any[];
  mentalHealthRecords: any[];
  providers: any[];
  certifications: {
    HIPAA: any;
    CMIA: any;
    CCPA: any;
  };
}

export interface HealthStatus {
  database: boolean;
  storage: boolean;
  network: boolean;
  replication: boolean;
  auditIntegrity: boolean;
}

export interface BackupResult {
  success: boolean;
  checksum: string;
  locations: string[];
  nextBackup: number;
}

export interface DRTestResult {
  backupRestore: boolean;
  failoverTime: number;
  dataIntegrity: boolean;
  rtoMet: boolean;
  rpoMet: boolean;
  dataLoss?: number;
}

export interface PerformanceMetrics {
  writeLatency: number;
  queryLatency: number;
  bufferUtilization: number;
  cacheHitRate: number;
  compressionRatio: number;
  complianceQuerySpeed: number;
  curesReportingLatency: number;
  totalEntries: number;
  storageUsedGB: number;
  estimatedDaysUntilFull: number;
}

export interface QueryParams {
  userId?: string;
  patientId?: string;
  startDate?: number;
  endDate?: number;
  action?: string;
  resourceType?: string;
}

export interface TamperDetection {
  type: 'BROKEN_CHAIN' | 'MODIFIED_ENTRY';
  entryId: string;
  expected?: string;
  actual?: string;
  expectedHash?: string;
  actualHash?: string;
}

export interface AnomalyScore {
  total: number;
  factors: string[];
}

export interface SecureExport {
  data: any;
  signature: string;
  timestamp: number;
  exportId: string;
  validUntil: number;
}