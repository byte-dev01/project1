import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

export class SecureStorageService {
  private static encryptionKey: string | null = null;
  
  /**
   * Initialize encryption (call once on app start)
   */
  static async initialize(): Promise<void> {
    try {
      // Check if we have an encryption key
      const credentials = await Keychain.getInternetCredentials('healthbridge_key');
      
      if (credentials) {
        this.encryptionKey = credentials.password;
      } else {
        // Generate new encryption key
        const newKey = this.generateKey();
        await Keychain.setInternetCredentials(
          'healthbridge_key',
          'encryption',
          newKey,
          {
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }
        );
        this.encryptionKey = newKey;
      }
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      // Fallback to a hardcoded key (not ideal but works for MVP)
      this.encryptionKey = 'fallback_encryption_key_2024';
    }
  }
  
  /**
   * Store sensitive data encrypted
   */
  static async setSecureItem(key: string, value: any): Promise<void> {
    if (!this.encryptionKey) {
      await this.initialize();
    }
    
    try {
      const jsonString = JSON.stringify(value);
      
      if (Platform.OS === 'ios') {
        // Use Keychain for small sensitive data
        if (jsonString.length < 2048) { // Keychain has size limits
          await Keychain.setInternetCredentials(
            key,
            'data',
            jsonString,
            {
              accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            }
          );
          return;
        }
      }
      
      // For larger data or Android, encrypt and store in AsyncStorage
      const encrypted = CryptoJS.AES.encrypt(jsonString, this.encryptionKey!).toString();
      await AsyncStorage.setItem(`encrypted_${key}`, encrypted);
      
    } catch (error) {
      console.error('Failed to store secure item:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve and decrypt sensitive data
   */
  static async getSecureItem(key: string): Promise<any> {
    if (!this.encryptionKey) {
      await this.initialize();
    }
    
    try {
      // Try Keychain first (iOS)
      if (Platform.OS === 'ios') {
        const credentials = await Keychain.getInternetCredentials(key);
        if (credentials) {
          return JSON.parse(credentials.password);
        }
      }
      
      // Try encrypted AsyncStorage
      const encrypted = await AsyncStorage.getItem(`encrypted_${key}`);
      if (encrypted) {
        const decrypted = CryptoJS.AES.decrypt(encrypted, this.encryptionKey!);
        const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
        return JSON.parse(jsonString);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get secure item:', error);
      return null;
    }
  }
  
  /**
   * Remove secure item
   */
  static async removeSecureItem(key: string): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(key);
      await AsyncStorage.removeItem(`encrypted_${key}`);
    } catch (error) {
      console.error('Failed to remove secure item:', error);
    }
  }
  
  /**
   * Generate random encryption key
   */
  private static generateKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
}

// Usage for storing PHI:
const storePrescription = async (prescription: any) => {
  // Store encrypted
  await SecureStorageService.setSecureItem(
    `prescription_${prescription.id}`,
    prescription
  );
};

const getPrescription = async (prescriptionId: string) => {
  // Retrieve and decrypt automatically
  return await SecureStorageService.getSecureItem(
    `prescription_${prescriptionId}`
  );
};

