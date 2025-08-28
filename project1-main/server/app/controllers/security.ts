import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AUTH_CONFIG } from '../../utils/constants';

interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

class SecurityManager {
  private sessionTimeout: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private isLocked: boolean = false;

  // Encryption
  async encryptData(data: string, key?: string): Promise<string> {
    const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-key';
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data + encryptionKey
    );
    return hash;
  }

  async generateSecureKey(length: number = 32): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(length);
    return btoa(String.fromCharCode(...randomBytes));
  }

  // Secure storage
  async secureStore(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async secureGet(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  async secureDelete(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  // Biometric authentication
  async checkBiometricAvailability(): Promise<{
    available: boolean;
    type?: string;
  }> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!compatible || !enrolled) {
      return { available: false };
    }

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let type = 'Biometric';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACE_ID)) {
      type = 'Face ID';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      type = 'Touch ID';
    }

    return { available: true, type };
  }

  async authenticateWithBiometrics(reason?: string): Promise<BiometricAuthResult> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || 'Authenticate to access HealthBridge',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Biometric authentication failed',
      };
    }
  }

  // Session management
  startSessionTimer(onTimeout: () => void): void {
    this.resetSessionTimer(onTimeout);
  }

  resetSessionTimer(onTimeout: () => void): void {
    this.lastActivityTime = Date.now();
    
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = setTimeout(() => {
      this.isLocked = true;
      onTimeout();
    }, AUTH_CONFIG.SESSION_TIMEOUT);
  }

  stopSessionTimer(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
  }

  getSessionTimeRemaining(): number {
    const elapsed = Date.now() - this.lastActivityTime;
    const remaining = AUTH_CONFIG.SESSION_TIMEOUT - elapsed;
    return Math.max(0, remaining);
  }

  isSessionExpired(): boolean {
    return this.getSessionTimeRemaining() === 0;
  }

  // Device security checks
  async isDeviceSecure(): Promise<boolean> {
    // Check if device has passcode/PIN set
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  }

  isDeviceRooted(): boolean {
    // Basic jailbreak/root detection
    if (Platform.OS === 'ios') {
      // Check for common jailbreak indicators
      const jailbreakPaths = [
        '/Applications/Cydia.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/bin/bash',
        '/usr/sbin/sshd',
        '/etc/apt',
      ];
      
      // In production, you'd use a more sophisticated method
      // This is a simplified example
      return false;
    } else if (Platform.OS === 'android') {
      // Check for common root indicators
      const rootPaths = [
        '/system/app/Superuser.apk',
        '/sbin/su',
        '/system/bin/su',
        '/system/xbin/su',
        '/data/local/xbin/su',
      ];
      
      // In production, you'd use a more sophisticated method
      return false;
    }
    
    return false;
  }

  // Audit logging
  async logSecurityEvent(event: {
    type: string;
    userId?: string;
    details?: any;
  }): Promise<void> {
    const logEntry = {
      ...event,
      timestamp: new Date().toISOString(),
      device: {
        model: Constants.deviceName,
        platform: Platform.OS,
        version: Platform.Version,
      },
    };

    // In production, send to secure logging service
    console.log('Security Event:', logEntry);
  }

  // Data sanitization
  sanitizeInput(input: string): string {
    // Remove potentially harmful characters
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized as T;
  }

  // Certificate pinning (simplified example)
  async validateServerCertificate(hostname: string): Promise<boolean> {
    // In production, implement proper certificate pinning
    // This would involve comparing server certificates against known pins
    const trustedHosts = ['api.healthbridge.com', 'healthbridge.com'];
    return trustedHosts.includes(hostname);
  }
}

export const securityManager = new SecurityManager();

