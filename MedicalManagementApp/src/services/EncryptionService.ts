import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: string | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  async initialize(): Promise<void> {
    // Generate or retrieve encryption key
    let key = await SecureStore.getItemAsync('encryption_key');
    if (!key) {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      key = Buffer.from(randomBytes).toString('base64');
      await SecureStore.setItemAsync('encryption_key', key);
    }
    this.encryptionKey = key;
  }

  encrypt(data: any, sessionKey?: string): string {
    const key = sessionKey || this.encryptionKey;
    if (!key) {
      throw new Error('No encryption key provided');
    }
    
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, key, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString();
  }

  decrypt(encryptedData: string, sessionKey?: string): any {
    const key = sessionKey || this.encryptionKey;
    if (!key) {
      throw new Error('No decryption key provided');
    }

    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  }
  
  // Add separate methods for session-based encryption
  encryptWithSessionKey(data: any, sessionKey: string): string {
    if (!sessionKey) {
      throw new Error('Session key is required');
    }
    
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, sessionKey, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString();
  }

  decryptWithSessionKey(encryptedData: string, sessionKey: string): any {
    if (!sessionKey) {
      throw new Error('Session key is required');
    }

    const decrypted = CryptoJS.AES.decrypt(encryptedData, sessionKey, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  }

  generateHash(data: any): string {
    const jsonString = JSON.stringify(data);
    return CryptoJS.SHA256(jsonString).toString();
  }

  verifyHash(data: any, expectedHash: string): boolean {
    const actualHash = this.generateHash(data);
    return actualHash === expectedHash;
  }

  async clear(): Promise<void> {
    this.encryptionKey = null;
    await SecureStore.deleteItemAsync('encryption_key');
  }
}

export const encryptionService = EncryptionService.getInstance();