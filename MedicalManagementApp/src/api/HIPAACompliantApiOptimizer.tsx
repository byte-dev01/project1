import { useState, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import { apiClient } from './ApiClient';
import { auditWrapper } from '../../src/services/AuditWrapper';
import { sessionManager } from '../../src/services/SessionManager';
import { encryptionService } from '../../src/services/EncryptionService';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform, AppState, AppStateStatus } from 'react-native';

interface SecureCacheEntry<T = any> {
  encryptedData: string;
  checksum: string;
  version: number;
  timestamp: number;
  expiresAt: number;
  dataClassification: 'PHI' | 'PII' | 'PUBLIC';
}

interface ConflictResolution {
  strategy: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL';
  version: number;
  lastModified: string;
  modifiedBy: string;
}

interface ExtendedAuditEntry {
  action: string;
  userId: string;
  patientId?: string;
  dataAccessed: string[];
  accessLevel: 'READ' | 'WRITE' | 'DELETE';
  ipAddress?: string;
  deviceId: string;
  sessionId: string;
  timestamp: string;
  dataIntegrityCheck: string;
  encryptionStatus: 'ENCRYPTED' | 'DECRYPTED';
  accessJustification?: string;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
}

// HIPAA-compliant data classification
enum DataClassification {
  PHI = 'PHI',           // Protected Health Information - highest security
  PII = 'PII',           // Personally Identifiable Information
  PUBLIC = 'PUBLIC'      // Non-sensitive data
}

// NO caching for these data types - always fetch fresh
const NO_CACHE_DATA = [
  'medications',
  'allergies', 
  'diagnoses',
  'lab_results_critical',
  'vitals_critical'
];

// Rate limiting configuration
class RateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxAttempts = 100;
  private readonly timeWindow = 60000; // 1 minute
  
  async checkLimit(userId: string, operation: string): Promise<boolean> {
    const key = `${userId}_${operation}`;
    const now = Date.now();
    
    const userAttempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside time window
    const validAttempts = userAttempts.filter(
      time => now - time < this.timeWindow
    );
    
    if (validAttempts.length >= this.maxAttempts) {
      await auditWrapper.logDetailed({
        action: 'RATE_LIMIT_EXCEEDED',
        userId,
        deviceId: '',
        sessionId: '',
        timestamp: new Date().toISOString(),
        dataIntegrityCheck: 'N/A',
        encryptionStatus: 'ENCRYPTED',
        accessLevel: 'READ',
        dataAccessed: [operation],
        result: 'FAILURE'
      });
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }
  
  clearUserLimits(userId: string): void {
    const keysToDelete: string[] = [];
    this.attempts.forEach((_, key) => {
      if (key.startsWith(`${userId}_`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.attempts.delete(key));
  }
}

// Certificate pinning for network security
class SecureNetworking {
  private trustedCertificates = new Map<string, string[]>();
  
  constructor() {
    // Initialize with your API certificates
    this.trustedCertificates.set('api.hospital.com', [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=' // Backup pin
    ]);
  }
  
  async verifyConnection(hostname: string): Promise<boolean> {
    try {
      // In production, use a proper certificate pinning library
      // This is a placeholder for the verification logic
      const pins = this.trustedCertificates.get(hostname);
      if (!pins || pins.length === 0) {
        await auditWrapper.logDetailed({
          action: 'CERTIFICATE_NOT_CONFIGURED',
          userId: 'SYSTEM',
          deviceId: '',
          sessionId: '',
          timestamp: new Date().toISOString(),
          dataIntegrityCheck: 'N/A',
          encryptionStatus: 'ENCRYPTED',
          accessLevel: 'READ',
          dataAccessed: [hostname],
          result: 'FAILURE'
        });
        return false;
      }
      
      // Actual certificate verification would happen here
      // with a native module or library
      return true;
    } catch (error) {
      await auditWrapper.logDetailed({
        action: 'CERTIFICATE_VALIDATION_FAILED',
        userId: 'SYSTEM',
        deviceId: '',
        sessionId: '',
        timestamp: new Date().toISOString(),
        dataIntegrityCheck: 'N/A',
        encryptionStatus: 'ENCRYPTED',
        accessLevel: 'READ',
        dataAccessed: [hostname],
        result: 'FAILURE'
      });
      return false;
    }
  }
}

class HIPAACompliantAPIOptimizer {
  private encryptionKey: string | null = null;
  private sessionKey: string | null = null;
  private dataValidators = new Map<string, (data: any) => boolean>();
  private rateLimiter = new RateLimiter();
  private secureNetworking = new SecureNetworking();
  private appStateSubscription: any = null;
  
  constructor() {
    this.initializeEncryption();
    this.setupValidators();
    this.setupAppStateHandling();
  }
  
  /**
   * Clear sensitive data from memory when app backgrounds (iOS security)
   */
  private setupAppStateHandling(): void {
    let previousState: AppStateStatus = AppState.currentState;
    
    this.appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      // iOS can dump memory when backgrounded - clear sensitive data
      if (nextState === 'background' && previousState === 'active') {
        // Overwrite sensitive keys with random data before nulling
        if (this.encryptionKey) {
          this.encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();
          this.encryptionKey = null;
        }
        if (this.sessionKey) {
          this.sessionKey = CryptoJS.lib.WordArray.random(256/8).toString();
          this.sessionKey = null;
        }
        
        // Clear validators which might contain sensitive patterns
        this.dataValidators.clear();
        
        // Force garbage collection if available (V8 engine)
        if (global.gc) {
          global.gc();
        }
        
        await this.createAuditLog('APP_BACKGROUNDED_MEMORY_CLEARED', {
          result: 'SUCCESS',
          encryptionStatus: 'ENCRYPTED',
          dataAccessed: ['MEMORY_CLEARED']
        });
      } else if (nextState === 'active' && previousState === 'background') {
        // Re-initialize encryption when app returns to foreground
        await this.initializeEncryption();
        this.setupValidators();
        
        await this.createAuditLog('APP_FOREGROUNDED_REINITIALIZED', {
          result: 'SUCCESS',
          encryptionStatus: 'ENCRYPTED',
          dataAccessed: ['ENCRYPTION_REINITIALIZED']
        });
      }
      
      previousState = nextState;
    });
  }
  
  /**
   * Cleanup method to be called on logout or app termination
   */
  async cleanup(): Promise<void> {
    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    // Clear all sensitive data
    this.encryptionKey = null;
    this.sessionKey = null;
    this.dataValidators.clear();
    
    // Clear rate limiter
    const userId = await sessionManager.getCurrentUserId();
    if (userId) {
      this.rateLimiter.clearUserLimits(userId);
    }
    
    await this.secureClearCache();
  }
  
  /**
   * Initialize per-session encryption keys
   */
  private async initializeEncryption(): Promise<void> {
    // Generate unique session key that's never stored
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    this.sessionKey = CryptoJS.lib.WordArray.random(256/8).toString();
    
    // Derive encryption key from user credentials + device ID
    const deviceId = await this.getSecureDeviceId();
    const userToken = await SecureStore.getItemAsync('userToken');
    if (userToken) {
      this.encryptionKey = CryptoJS.PBKDF2(
        userToken + deviceId,
        this.sessionKey,
        { keySize: 256/32, iterations: 10000 }
      ).toString();
    }
  }
  
  /**
   * Setup data validators for different PHI types
   */
  private setupValidators(): void {
    // Patient data validator
    this.dataValidators.set('patient', (data: any) => {
      return !!(data.id && data.firstName && data.lastName && data.dateOfBirth);
    });
    
    // Medication validator
    this.dataValidators.set('medication', (data: any) => {
      return !!(data.name && data.dosage && data.prescribedBy && data.startDate);
    });
    
    // Lab result validator
    this.dataValidators.set('labResult', (data: any) => {
      return !!(data.testName && data.value !== undefined && data.date);
    });
  }
  
  /**
   * Get secure device identifier
   */
  private async getSecureDeviceId(): Promise<string> {
    let deviceId = await SecureStore.getItemAsync('deviceId');
    if (!deviceId) {
      deviceId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Platform.OS}-${Date.now()}-${Math.random()}`
      );
      await SecureStore.setItemAsync('deviceId', deviceId);
    }
    return deviceId;
  }
  
  /**
   * Encrypt PHI data with integrity check
   */
  private encryptPHI(data: any): { encrypted: string; checksum: string } {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    const jsonString = JSON.stringify(data);
    
    // Generate checksum for integrity verification
    const checksum = CryptoJS.SHA256(jsonString).toString();
    
    // Encrypt with AES-256
    const encrypted = CryptoJS.AES.encrypt(
      jsonString,
      this.encryptionKey,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    ).toString();
    
    return { encrypted, checksum };
  }
  
  /**
   * Decrypt PHI data with integrity verification
   */
  private decryptPHI(encrypted: string, expectedChecksum: string): any {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
      encrypted,
      this.encryptionKey,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    
    // Verify integrity
    const actualChecksum = CryptoJS.SHA256(jsonString).toString();
    if (actualChecksum !== expectedChecksum) {
      throw new Error('Data integrity check failed - possible tampering detected');
    }
    
    return JSON.parse(jsonString);
  }
  
  /**
   * Create comprehensive HIPAA audit log
   */
  private async createAuditLog(
    action: string,
    metadata: Partial<ExtendedAuditEntry>
  ): Promise<void> {
    const deviceId = await this.getSecureDeviceId();
    const sessionId = await sessionManager.getSessionId();
    const userId = await sessionManager.getCurrentUserId();
    
    await auditWrapper.logDetailed({
      action,
      userId: userId || 'UNKNOWN',
      deviceId: deviceId,
      sessionId: sessionId || 'NO_SESSION',
      timestamp: new Date().toISOString(),
      dataIntegrityCheck: metadata.dataIntegrityCheck || 'VERIFIED',
      encryptionStatus: metadata.encryptionStatus || 'ENCRYPTED',
      accessLevel: metadata.accessLevel || 'READ',
      dataAccessed: metadata.dataAccessed || [],
      result: metadata.result || 'SUCCESS',
      patientId: metadata.patientId,
      ipAddress: metadata.ipAddress,
      accessJustification: metadata.accessJustification
    });
  }
  
  /**
   * Validate data before any operation
   */
  private validateData(data: any, dataType: string): boolean {
    const validator = this.dataValidators.get(dataType);
    if (!validator) {
      // No validator means we should be extra careful
      return false;
    }
    return validator(data);
  }
  
  /**
   * Secure fetch with encryption, validation, and comprehensive audit
   */
  async secureFetchPHI<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      dataType: string;
      dataClassification: DataClassification;
      patientId?: string;
      skipCache?: boolean;
      conflictResolution?: ConflictResolution;
      apiHostname?: string;
    }
  ): Promise<T> {
    const { 
      dataType,
      dataClassification,
      patientId,
      skipCache = false,
      conflictResolution,
      apiHostname = 'api.hospital.com'
    } = options;
    
    // NEVER cache critical medical data
    const shouldCache = !NO_CACHE_DATA.includes(dataType) && !skipCache;
    
    // Validate session
    const isValid = await sessionManager.isSessionValid();
    if (!isValid) {
      await this.createAuditLog('SESSION_INVALID_ACCESS_ATTEMPT', {
        result: 'FAILURE',
        dataAccessed: [dataType]
      });
      throw new Error('Session expired');
    }
    
    // Check rate limiting
    const userId = await sessionManager.getCurrentUserId();
    if (userId) {
      const canProceed = await this.rateLimiter.checkLimit(userId, `fetch_${dataType}`);
      if (!canProceed) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
    }
    
    // Verify certificate pinning for network security
    const isConnectionSecure = await this.secureNetworking.verifyConnection(apiHostname);
    if (!isConnectionSecure) {
      await this.createAuditLog('INSECURE_CONNECTION_BLOCKED', {
        result: 'FAILURE',
        dataAccessed: [dataType]
      });
      throw new Error('Connection security verification failed');
    }
    
    try {
      // Check encrypted cache if allowed
      if (shouldCache && dataClassification !== DataClassification.PHI) {
        const cachedJson = await SecureStore.getItemAsync(`cache_${key}`);
        if (cachedJson) {
          const cached: SecureCacheEntry = JSON.parse(cachedJson);
          
          if (cached.expiresAt > Date.now()) {
            // Decrypt and verify integrity
            const data = this.decryptPHI(cached.encryptedData, cached.checksum);
            
            // Validate data structure
            if (!this.validateData(data, dataType)) {
              throw new Error('Cached data validation failed');
            }
            
            // Log cache access
            await this.createAuditLog('CACHE_ACCESS', {
              dataAccessed: [dataType],
              patientId,
              encryptionStatus: 'ENCRYPTED'
            });
            
            return data as T;
          }
        }
      }
      
      // Fetch fresh data
      const data = await fetcher();
      
      // Validate fetched data
      if (!this.validateData(data, dataType)) {
        await this.createAuditLog('DATA_VALIDATION_FAILURE', {
          result: 'FAILURE',
          dataAccessed: [dataType],
          patientId
        });
        throw new Error('Data validation failed');
      }
      
      // Handle conflict resolution if provided
      if (conflictResolution && (data as any).version) {
        if ((data as any).version < conflictResolution.version) {
          await this.createAuditLog('VERSION_CONFLICT', {
            dataAccessed: [dataType],
            patientId
          });
          
          switch (conflictResolution.strategy) {
            case 'SERVER_WINS':
              // Use server data as-is
              break;
            case 'CLIENT_WINS':
              throw new Error('Client version is newer - manual resolution required');
            case 'MANUAL':
              throw new Error('Version conflict requires manual resolution');
          }
        }
      }
      
      // Cache if appropriate (never cache PHI)
      if (shouldCache && dataClassification !== DataClassification.PHI) {
        const { encrypted, checksum } = this.encryptPHI(data);
        const cacheEntry: SecureCacheEntry = {
          encryptedData: encrypted,
          checksum,
          version: (data as any).version || 1,
          timestamp: Date.now(),
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 min max
          dataClassification
        };
        
        await SecureStore.setItemAsync(
          `cache_${key}`,
          JSON.stringify(cacheEntry)
        );
      }
      
      // Comprehensive audit log
      await this.createAuditLog('API_DATA_ACCESS', {
        dataAccessed: [dataType],
        patientId,
        accessLevel: 'READ',
        result: 'SUCCESS'
      });
      
      return data;
      
    } catch (error: any) {
      // Log failure
      await this.createAuditLog('API_ACCESS_ERROR', {
        result: 'FAILURE',
        dataAccessed: [dataType],
        patientId
      });
      
      throw error;
    }
  }
  
  /**
   * Clear all cached data securely
   */
  async secureClearCache(): Promise<void> {
    try {
      // Get all cache keys
      const keys = await SecureStore.getItemAsync('cache_keys');
      if (keys) {
        const keyList = JSON.parse(keys);
        for (const key of keyList) {
          await SecureStore.deleteItemAsync(key);
        }
      }
      
      // Clear encryption keys from memory
      this.encryptionKey = null;
      this.sessionKey = null;
      
      await this.createAuditLog('CACHE_CLEARED', {
        result: 'SUCCESS'
      });
    } catch (error) {
      await this.createAuditLog('CACHE_CLEAR_ERROR', {
        result: 'FAILURE'
      });
    }
  }
}

/**
 * Hook for secure PHI data access - NO caching for critical data
 */
export function useSecurePHIData<T = any>(
  endpoint: string,
  dataType: string,
  patientId?: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const optimizer = new HIPAACompliantAPIOptimizer();
      
      const result = await optimizer.secureFetchPHI<T>(
        `${endpoint}_${patientId}`,
        async () => {
          const response = await apiClient.get<T>(endpoint);
          return response.data;
        },
        {
          dataType,
          dataClassification: DataClassification.PHI,
          patientId,
          skipCache: true // ALWAYS skip cache for PHI
        }
      );
      
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load secure data');
    } finally {
      setLoading(false);
    }
  }, [endpoint, dataType, patientId]);
  
  return { data, loading, error, refetch: fetchData };
}

export const hipaaCompliantOptimizer = new HIPAACompliantAPIOptimizer();