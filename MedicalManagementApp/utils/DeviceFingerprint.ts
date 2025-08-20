import DeviceInfo from 'react-native-device-info';
import { NativeModules, Platform } from 'react-native';
import CryptoJS from 'crypto-js';

const { SecurityModule } = NativeModules;

export class DeviceFingerprint {
  private static instance: DeviceFingerprint;
  private fingerprint: string | null = null;
  private deviceAttributes: Map<string, any> = new Map();

  static getInstance(): DeviceFingerprint {
    if (!DeviceFingerprint.instance) {
      DeviceFingerprint.instance = new DeviceFingerprint();
    }
    return DeviceFingerprint.instance;
  }

  async generate(): Promise<string> {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    try {
      // Collect device attributes
      const attributes = await this.collectDeviceAttributes();
      
      // Generate deterministic fingerprint
      const fingerprintData = JSON.stringify(attributes, Object.keys(attributes).sort());
      this.fingerprint = CryptoJS.SHA256(fingerprintData).toString();
      
      // Store for attestation
      await this.storeFingerprint(this.fingerprint);
      
      return this.fingerprint;
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      throw new Error('Device fingerprint generation failed');
    }
  }

  private async collectDeviceAttributes(): Promise<any> {
    const attributes: any = {
      deviceId: await DeviceInfo.getUniqueId(),
      deviceModel: DeviceInfo.getModel(),
      systemName: DeviceInfo.getSystemName(),
      systemVersion: DeviceInfo.getSystemVersion(),
      bundleId: DeviceInfo.getBundleId(),
      buildNumber: DeviceInfo.getBuildNumber(),
      deviceType: DeviceInfo.getDeviceType(),
      isTablet: DeviceInfo.isTablet(),
    };

    if (Platform.OS === 'ios') {
      attributes.iosAttributes = {
        deviceName: await DeviceInfo.getDeviceName(),
        isJailbroken: await SecurityModule.isJailbroken(),
        hasNotch: DeviceInfo.hasNotch(),
        carrier: await DeviceInfo.getCarrier(),
      };
    }

    // Hardware attributes
    attributes.hardware = {
      totalMemory: await DeviceInfo.getTotalMemory(),
      totalDiskCapacity: await DeviceInfo.getTotalDiskCapacity(),
      processor: await this.getProcessorInfo(),
    };

    // Security attributes
    attributes.security = {
      isPinOrFingerprintSet: await DeviceInfo.isPinOrFingerprintSet(),
      supportedBiometry: await this.getSupportedBiometry(),
      securityPatchLevel: await this.getSecurityPatchLevel(),
    };

    return attributes;
  }

  private async getProcessorInfo(): Promise<string> {
    if (Platform.OS === 'ios') {
      // Get iOS processor info
      return await SecurityModule.getProcessorInfo();
    }
    return 'unknown';
  }

  private async getSupportedBiometry(): Promise<string[]> {
    const biometry = [];
    if (Platform.OS === 'ios') {
      const biometryType = await SecurityModule.getBiometryType();
      if (biometryType) {
        biometry.push(biometryType);
      }
    }
    return biometry;
  }

  private async getSecurityPatchLevel(): Promise<string> {
    if (Platform.OS === 'ios') {
      return DeviceInfo.getSystemVersion(); // iOS version is security patch
    }
    return 'unknown';
  }

  private async storeFingerprint(fingerprint: string): Promise<void> {
    // Store in secure keychain
    await SecurityModule.storeSecureValue('device_fingerprint', fingerprint);
  }

  async verify(providedFingerprint: string): Promise<boolean> {
    const currentFingerprint = await this.generate();
    return currentFingerprint === providedFingerprint;
  }

  async hasChanged(): Promise<boolean> {
    const storedFingerprint = await SecurityModule.getSecureValue('device_fingerprint');
    if (!storedFingerprint) {
      return false;
    }
    
    const currentFingerprint = await this.generate();
    return storedFingerprint !== currentFingerprint;
  }
}

export const deviceFingerprint = DeviceFingerprint.getInstance();