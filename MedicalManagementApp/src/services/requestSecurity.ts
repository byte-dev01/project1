import { NativeModules, Platform } from 'react-native';
import CryptoJS from 'crypto-js';
import DeviceInfo from 'react-native-device-info';
import { keychainService } from '../../services/security/keychainService';

class RequestSecurity {
  private deviceFingerprint: string | null = null;
  private attestationKey: string | null = null;

  async initialize(): Promise<void> {
    this.deviceFingerprint = await this.generateDeviceFingerprint();
    
    if (Platform.OS === 'ios') {
      await this.setupAppAttestation();
    }
  }

  private async generateDeviceFingerprint(): Promise<string> {
    const components = [
      await DeviceInfo.getUniqueId(),
      await DeviceInfo.getModel(),
      await DeviceInfo.getSystemVersion(),
      await DeviceInfo.getBundleId(),
      await DeviceInfo.getCarrier(),
    ];

    // Create stable fingerprint
    const fingerprint = CryptoJS.SHA256(components.join('|')).toString();
    
    // Store securely
    await keychainService.store('device_fingerprint', fingerprint);
    
    return fingerprint;
  }

  private async setupAppAttestation(): Promise<void> {
    // iOS App Attestation
    try {
      const { AppAttestation } = NativeModules;
      if (AppAttestation) {
        this.attestationKey = await AppAttestation.generateKey();
        await keychainService.store('attestation_key', this.attestationKey);
      }
    } catch (error) {
      console.error('App Attestation setup failed:', error);
    }
  }

  async signRequest(
    method: string,
    url: string,
    body?: any
  ): Promise<{ signature: string; timestamp: number; nonce: string }> {
    const timestamp = Date.now();
    const nonce = this.generateNonce();
    
    // Create canonical request
    const canonicalRequest = [
      method.toUpperCase(),
      url,
      timestamp,
      nonce,
      body ? JSON.stringify(body) : '',
    ].join('\n');

    // Get signing key from keychain
    const signingKey = await keychainService.retrieve('api_signing_key');
    if (!signingKey) {
      throw new Error('Signing key not found');
    }

    // Generate signature
    const signature = CryptoJS.HmacSHA256(canonicalRequest, signingKey).toString();

    return { signature, timestamp, nonce };
  }

  private generateNonce(): string {
    return CryptoJS.lib.WordArray.random(16).toString();
  }

  async createSecurityHeaders(
    method: string,
    url: string,
    body?: any
  ): Promise<Record<string, string>> {
    const { signature, timestamp, nonce } = await this.signRequest(method, url, body);
    
    const headers: Record<string, string> = {
      'X-Device-Fingerprint': this.deviceFingerprint || '',
      'X-Request-Signature': signature,
      'X-Request-Timestamp': timestamp.toString(),
      'X-Request-Nonce': nonce,
      'X-Client-Version': DeviceInfo.getVersion(),
      'X-Platform': Platform.OS,
    };

    if (this.attestationKey && Platform.OS === 'ios') {
      const { AppAttestation } = NativeModules;
    }
    
    return headers;
  }
}
