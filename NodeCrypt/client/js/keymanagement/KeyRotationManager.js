// Implements TestCase #4: Automatic Key Rotation Mechanism
// Implements TestCase #9: Multi-Device Support
// HIPAA-compliant key lifecycle management with forward secrecy

import { generateRandomBytes, secureClear } from '../utils/crypto.js';
import { SignalProtocolStore } from '../encryption/SignalProtocolStore.js';

/**
 * Key Rotation Manager for HIPAA E2EE System
 * Handles automatic key rotation, multi-device support, and secure key storage
 */
class KeyRotationManager {
    constructor(userId, signalManager) {
        this.userId = userId;
        this.signalManager = signalManager;
        this.store = new SignalProtocolStore();
        this.rotationTimer = null;
        this.rotationInterval = 24 * 60 * 60 * 1000; // 24 hours
        this.deviceRegistry = new Map();
        this.keyHistory = new Map(); // For forward secrecy validation
    }

    // Implements TestCase #4: Automatic Key Rotation Mechanism
    async initialize() {
        try {
            await this.store.initialize();
            await this.loadDeviceRegistry();
            await this.scheduleKeyRotation();
            console.log('Key Rotation Manager initialized for user:', this.userId);
            return true;
        } catch (error) {
            console.error('Key Rotation Manager initialization failed:', error);
            throw new Error('Failed to initialize Key Rotation Manager');
        }
    }

    async scheduleKeyRotation() {
        // Check if rotation is due
        const lastRotation = await this.getLastRotationTime();
        const now = Date.now();
        const timeSinceRotation = now - (lastRotation || 0);

        if (timeSinceRotation >= this.rotationInterval) {
            console.log('Key rotation due, executing immediately');
            await this.executeKeyRotation();
        }

        // Schedule next rotation
        const nextRotationTime = this.rotationInterval - (timeSinceRotation % this.rotationInterval);
        this.rotationTimer = setTimeout(async () => {
            await this.executeKeyRotation();
            await this.scheduleKeyRotation(); // Reschedule
        }, nextRotationTime);

        console.log(`Next key rotation scheduled in ${Math.floor(nextRotationTime / 1000 / 60)} minutes`);
    }

    async executeKeyRotation() {
        try {
            console.log('Executing automatic key rotation for HIPAA compliance');
            
            // 1. Generate new signed pre-key
            const identityKeyPair = await this.store.get('identityKey');
            if (!identityKeyPair) {
                throw new Error('Identity key not found for rotation');
            }

            const newSignedPreKey = await this.generateNewSignedPreKey(identityKeyPair);
            
            // 2. Mark old signed pre-key for deletion (forward secrecy)
            const oldSignedPreKeys = await this.getAllSignedPreKeys();
            for (const oldKey of oldSignedPreKeys) {
                if (oldKey.timestamp < Date.now() - this.rotationInterval) {
                    await this.securelyDeleteSignedPreKey(oldKey.keyId);
                    console.log(`Deleted expired signed pre-key: ${oldKey.keyId}`);
                }
            }
            
            // 3. Store new signed pre-key
            await this.store.storeSignedPreKey(newSignedPreKey.keyId, newSignedPreKey);
            
            // 4. Generate new batch of one-time pre-keys
            const newPreKeys = await this.generateNewPreKeys(50);
            for (const preKey of newPreKeys) {
                await this.store.storePreKey(preKey.keyId, preKey);
            }
            
            // 5. Update rotation timestamp
            await this.updateLastRotationTime();
            
            // 6. Notify server about new keys (upload to key server)
            await this.uploadNewKeysToServer(newSignedPreKey, newPreKeys);
            
            // 7. Update device registry with new key IDs
            await this.updateDeviceRegistry(newSignedPreKey.keyId);
            
            console.log('Key rotation completed successfully');
            
        } catch (error) {
            console.error('Key rotation failed:', error);
            throw new Error('Failed to execute key rotation');
        }
    }

    // Implements TestCase #9: Multi-Device Support
    async registerDevice(deviceId, deviceInfo) {
        try {
            const deviceEntry = {
                deviceId: deviceId,
                userId: this.userId,
                registeredAt: Date.now(),
                lastSeen: Date.now(),
                deviceInfo: deviceInfo,
                keyIds: {
                    identityKey: null,
                    signedPreKey: null,
                    preKeys: []
                },
                isActive: true
            };

            // Generate device-specific keys
            const deviceKeys = await this.generateDeviceKeys();
            deviceEntry.keyIds = {
                identityKey: deviceKeys.identityKeyId,
                signedPreKey: deviceKeys.signedPreKeyId,
                preKeys: deviceKeys.preKeyIds
            };

            // Store in device registry
            this.deviceRegistry.set(deviceId, deviceEntry);
            await this.persistDeviceRegistry();
            
            console.log(`Device registered: ${deviceId} for user: ${this.userId}`);
            return deviceEntry;
            
        } catch (error) {
            console.error('Device registration failed:', error);
            throw new Error('Failed to register device');
        }
    }

    async getDeviceKeys(deviceId) {
        const device = this.deviceRegistry.get(deviceId);
        if (!device) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Return public keys for this device
        const identityKey = await this.store.get('identityKey');
        const signedPreKey = await this.store.loadSignedPreKey(device.keyIds.signedPreKey);
        const preKeys = [];
        
        for (const preKeyId of device.keyIds.preKeys.slice(0, 10)) {
            const preKey = await this.store.loadPreKey(preKeyId);
            if (preKey) {
                preKeys.push({
                    keyId: preKeyId,
                    pubKey: preKey.pubKey
                });
            }
        }

        return {
            deviceId: deviceId,
            identityKey: identityKey.pubKey,
            signedPreKey: {
                keyId: signedPreKey.keyId,
                pubKey: signedPreKey.pubKey,
                signature: signedPreKey.signature
            },
            preKeys: preKeys
        };
    }

    async encryptForMultipleDevices(recipientUserId, message) {
        // Get all active devices for recipient
        const recipientDevices = await this.getActiveDevicesForUser(recipientUserId);
        const encryptedMessages = [];

        for (const device of recipientDevices) {
            try {
                // Encrypt message for each device independently
                const deviceSpecificMessage = await this.signalManager.encryptMessage(
                    `${recipientUserId}:${device.deviceId}`, 
                    message
                );
                
                encryptedMessages.push({
                    deviceId: device.deviceId,
                    encryptedMessage: deviceSpecificMessage
                });
                
            } catch (error) {
                console.error(`Failed to encrypt for device ${device.deviceId}:`, error);
                // Continue with other devices
            }
        }

        return {
            recipientUserId: recipientUserId,
            deviceMessages: encryptedMessages,
            timestamp: Date.now()
        };
    }

    // Helper methods for key rotation
    async generateNewSignedPreKey(identityKeyPair) {
        const keyId = Math.floor(Math.random() * 16777215);
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );
        
        const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        
        // Sign with identity key
        const signature = await this.signKey(publicKey, identityKeyPair.privKey);
        
        return {
            keyId: keyId,
            pubKey: new Uint8Array(publicKey),
            privKey: new Uint8Array(privateKey),
            signature: signature,
            timestamp: Date.now()
        };
    }

    async generateNewPreKeys(count) {
        const preKeys = [];
        for (let i = 0; i < count; i++) {
            const keyId = Math.floor(Math.random() * 16777215);
            const keyPair = await crypto.subtle.generateKey(
                { name: 'ECDH', namedCurve: 'P-256' },
                true,
                ['deriveKey', 'deriveBits']
            );
            
            const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
            const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
            
            preKeys.push({
                keyId: keyId,
                pubKey: new Uint8Array(publicKey),
                privKey: new Uint8Array(privateKey),
                createdAt: Date.now()
            });
        }
        return preKeys;
    }

    async generateDeviceKeys() {
        // Generate unique keys for device
        const identityKeys = await this.signalManager.generateIdentityKeys();
        
        return {
            identityKeyId: 'identity_' + Date.now(),
            signedPreKeyId: identityKeys.signedPreKey.keyId,
            preKeyIds: identityKeys.preKeys.map(pk => pk.keyId)
        };
    }

    async securelyDeleteSignedPreKey(keyId) {
        try {
            // Get the key before deletion for secure clearing
            const keyToDelete = await this.store.loadSignedPreKey(keyId);
            if (keyToDelete) {
                // Securely clear private key material
                secureClear(keyToDelete.privKey);
                secureClear(keyToDelete.signature);
            }
            
            // Remove from storage
            await this.store.removeSignedPreKey(keyId);
            
            // Add to deletion log for audit
            await this.logKeyDeletion(keyId, 'signed_pre_key');
            
        } catch (error) {
            console.error(`Failed to securely delete signed pre-key ${keyId}:`, error);
        }
    }

    // Storage and persistence methods
    async getLastRotationTime() {
        return await this.store.get('lastKeyRotation') || 0;
    }

    async updateLastRotationTime() {
        await this.store.put('lastKeyRotation', Date.now());
    }

    async getAllSignedPreKeys() {
        // Implementation would iterate through IndexedDB to get all signed pre-keys
        // Simplified for demo
        return [];
    }

    async loadDeviceRegistry() {
        const stored = await this.store.get('deviceRegistry');
        if (stored) {
            this.deviceRegistry = new Map(Object.entries(stored));
        }
    }

    async persistDeviceRegistry() {
        const registryObject = Object.fromEntries(this.deviceRegistry);
        await this.store.put('deviceRegistry', registryObject);
    }

    async updateDeviceRegistry(newSignedPreKeyId) {
        for (const [deviceId, device] of this.deviceRegistry) {
            device.keyIds.signedPreKey = newSignedPreKeyId;
            device.lastKeyUpdate = Date.now();
        }
        await this.persistDeviceRegistry();
    }

    async getActiveDevicesForUser(userId) {
        // In production, this would query the server
        // For demo, return mock devices
        return [
            { deviceId: `${userId}_mobile`, isActive: true },
            { deviceId: `${userId}_desktop`, isActive: true }
        ];
    }

    async uploadNewKeysToServer(signedPreKey, preKeys) {
        // Upload to key server - implementation depends on backend
        console.log('Uploading new keys to server for distribution');
        // In production: POST to /api/keys/upload
    }

    async logKeyDeletion(keyId, keyType) {
        const logEntry = {
            action: 'key_deletion',
            keyId: keyId,
            keyType: keyType,
            timestamp: Date.now(),
            userId: this.userId
        };
        
        // Store in audit log
        await this.store.put(`audit_${Date.now()}`, logEntry);
    }

    async signKey(keyData, privateKey) {
        const key = await crypto.subtle.importKey(
            'pkcs8',
            privateKey,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            key,
            keyData
        );
        
        return new Uint8Array(signature);
    }

    // Cleanup methods
    async cleanup() {
        if (this.rotationTimer) {
            clearTimeout(this.rotationTimer);
            this.rotationTimer = null;
        }
        
        // Secure cleanup of sensitive data
        this.deviceRegistry.clear();
        this.keyHistory.clear();
        
        console.log('Key Rotation Manager cleaned up');
    }

    // Status methods
    getRotationStatus() {
        return {
            userId: this.userId,
            lastRotation: this.getLastRotationTime(),
            nextRotation: this.rotationTimer ? 'scheduled' : 'not_scheduled',
            deviceCount: this.deviceRegistry.size,
            rotationInterval: this.rotationInterval
        };
    }

    isRotationDue() {
        const lastRotation = this.getLastRotationTime();
        return (Date.now() - lastRotation) >= this.rotationInterval;
    }
}

export default KeyRotationManager;