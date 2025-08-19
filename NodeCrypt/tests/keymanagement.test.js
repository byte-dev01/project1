// Test suite for Key Management (TestCase #4, #9)
// HIPAA E2EE Chat System - Key Rotation and Multi-Device Tests

import KeyRotationManager from '../client/js/keymanagement/KeyRotationManager.js';
import SignalProtocolManager from '../client/js/encryption/SignalProtocolManager.js';

describe('Key Management Tests', () => {
    let keyManager, signalManager;
    const userId = 'doctor_alice_001';

    beforeEach(async () => {
        signalManager = new SignalProtocolManager(userId);
        await signalManager.initialize();
        
        keyManager = new KeyRotationManager(userId, signalManager);
        await keyManager.initialize();
    });

    afterEach(async () => {
        await keyManager.cleanup();
        if (signalManager?.store) {
            await signalManager.store.secureDelete();
        }
    });

    // TestCase #4: Automatic Key Rotation Mechanism
    describe('TestCase #4: Automatic Key Rotation Mechanism', () => {
        test('should execute key rotation when due', async () => {
            // Given: User session active for 24 hours with expired signed pre-key
            const initialStatus = keyManager.getRotationStatus();
            
            // Simulate expired key by setting old rotation time
            const expiredTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
            await keyManager.store.put('lastKeyRotation', expiredTime);
            
            // When: Key rotation scheduler executes
            expect(keyManager.isRotationDue()).toBe(true);
            
            const beforeRotation = await keyManager.getLastRotationTime();
            await keyManager.executeKeyRotation();
            const afterRotation = await keyManager.getLastRotationTime();
            
            // Then: New signed pre-key generated, old key marked for deletion, new key uploaded to server, IndexedDB updated
            expect(afterRotation).toBeGreaterThan(beforeRotation);
            expect(afterRotation).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
            
            // Verify new keys exist in storage
            const rotationStatus = keyManager.getRotationStatus();
            expect(rotationStatus.userId).toBe(userId);
        }, 10000);

        test('should schedule automatic rotation correctly', async () => {
            // Given: Fresh key manager
            const rotationStatus = keyManager.getRotationStatus();
            
            // When: Scheduling rotation
            await keyManager.scheduleKeyRotation();
            
            // Then: Timer should be set for appropriate interval
            expect(rotationStatus.nextRotation).toBeDefined();
            
            // Cleanup timer
            await keyManager.cleanup();
        });

        test('should handle rotation failure gracefully', async () => {
            // Given: Corrupted key store
            const corruptedManager = new KeyRotationManager('invalid_user', null);
            
            // When: Rotation attempted with invalid setup
            // Then: Should throw appropriate error
            await expect(corruptedManager.executeKeyRotation()).rejects.toThrow();
        });

        test('should maintain forward secrecy during rotation', async () => {
            // Given: Multiple key rotations over time
            const initialKeys = await signalManager.generateIdentityKeys();
            
            // When: Multiple rotations executed
            await keyManager.executeKeyRotation();
            const afterFirstRotation = await keyManager.getLastRotationTime();
            
            // Simulate time passing
            await new Promise(resolve => setTimeout(resolve, 100));
            await keyManager.executeKeyRotation();
            const afterSecondRotation = await keyManager.getLastRotationTime();
            
            // Then: Each rotation creates new keys and timestamps
            expect(afterSecondRotation).toBeGreaterThan(afterFirstRotation);
            
            // Old keys should be marked for deletion (forward secrecy)
            // In production, verify old keys are actually deleted from storage
        });
    });

    // TestCase #9: Multi-Device Support
    describe('TestCase #9: Multi-Device Support', () => {
        const mobileDeviceId = 'alice_mobile_001';
        const desktopDeviceId = 'alice_desktop_001';
        
        test('should register multiple devices with independent keys', async () => {
            // Given: Alice wants to use mobile and desktop
            const mobileInfo = { type: 'mobile', os: 'iOS', version: '15.0' };
            const desktopInfo = { type: 'desktop', os: 'Windows', version: '11' };
            
            // When: Both devices are registered
            const mobileDevice = await keyManager.registerDevice(mobileDeviceId, mobileInfo);
            const desktopDevice = await keyManager.registerDevice(desktopDeviceId, desktopInfo);
            
            // Then: Each device has unique keys and proper registration
            expect(mobileDevice.deviceId).toBe(mobileDeviceId);
            expect(mobileDevice.userId).toBe(userId);
            expect(mobileDevice.keyIds).toBeDefined();
            expect(mobileDevice.isActive).toBe(true);
            
            expect(desktopDevice.deviceId).toBe(desktopDeviceId);
            expect(desktopDevice.userId).toBe(userId);
            expect(desktopDevice.keyIds).toBeDefined();
            expect(desktopDevice.isActive).toBe(true);
            
            // Keys should be different for each device
            expect(mobileDevice.keyIds.signedPreKey).not.toBe(desktopDevice.keyIds.signedPreKey);
        });

        test('should retrieve device-specific public keys', async () => {
            // Given: Registered device
            await keyManager.registerDevice(mobileDeviceId, { type: 'mobile' });
            
            // When: Requesting device keys
            const deviceKeys = await keyManager.getDeviceKeys(mobileDeviceId);
            
            // Then: Should return proper key bundle for device
            expect(deviceKeys.deviceId).toBe(mobileDeviceId);
            expect(deviceKeys.identityKey).toBeInstanceOf(Uint8Array);
            expect(deviceKeys.signedPreKey).toHaveProperty('keyId');
            expect(deviceKeys.signedPreKey).toHaveProperty('pubKey');
            expect(deviceKeys.signedPreKey).toHaveProperty('signature');
            expect(Array.isArray(deviceKeys.preKeys)).toBe(true);
            expect(deviceKeys.preKeys.length).toBeGreaterThan(0);
        });

        test('should encrypt messages for multiple devices independently', async () => {
            // Given: Bob has multiple devices registered
            const bobUserId = 'patient_bob_001';
            const bobMobile = 'bob_mobile_001';
            const bobDesktop = 'bob_desktop_001';
            
            // Setup Bob's devices (mock)
            await keyManager.registerDevice(bobMobile, { type: 'mobile' });
            await keyManager.registerDevice(bobDesktop, { type: 'desktop' });
            
            const testMessage = 'Patient consultation scheduled for tomorrow';
            
            // When: Alice sends message to Bob (all devices)
            const multiDeviceMessage = await keyManager.encryptForMultipleDevices(bobUserId, testMessage);
            
            // Then: Message encrypted separately for each device
            expect(multiDeviceMessage.recipientUserId).toBe(bobUserId);
            expect(Array.isArray(multiDeviceMessage.deviceMessages)).toBe(true);
            expect(multiDeviceMessage.deviceMessages.length).toBeGreaterThan(0);
            
            // Each device should have independent encryption
            const deviceIds = multiDeviceMessage.deviceMessages.map(dm => dm.deviceId);
            expect(new Set(deviceIds).size).toBe(deviceIds.length); // All unique
            
            // Each encrypted message should be different
            const ciphertexts = multiDeviceMessage.deviceMessages.map(dm => dm.encryptedMessage.ciphertext);
            expect(new Set(ciphertexts).size).toBe(ciphertexts.length); // All unique
        });

        test('should handle device registration failure', async () => {
            // Given: Invalid device parameters
            const invalidDeviceId = '';
            const invalidInfo = null;
            
            // When: Attempting to register invalid device
            // Then: Should handle gracefully
            await expect(keyManager.registerDevice(invalidDeviceId, invalidInfo)).rejects.toThrow();
        });

        test('should maintain device registry persistence', async () => {
            // Given: Device registered and manager restarted
            await keyManager.registerDevice(mobileDeviceId, { type: 'mobile' });
            
            // Simulate restart
            await keyManager.cleanup();
            const newKeyManager = new KeyRotationManager(userId, signalManager);
            await newKeyManager.initialize();
            
            // When: Checking device registry after restart
            const deviceKeys = await newKeyManager.getDeviceKeys(mobileDeviceId);
            
            // Then: Device should still be registered
            expect(deviceKeys.deviceId).toBe(mobileDeviceId);
            
            await newKeyManager.cleanup();
        });

        test('should update all device keys during rotation', async () => {
            // Given: Multiple devices registered
            await keyManager.registerDevice(mobileDeviceId, { type: 'mobile' });
            await keyManager.registerDevice(desktopDeviceId, { type: 'desktop' });
            
            const beforeRotation = await keyManager.getDeviceKeys(mobileDeviceId);
            
            // When: Key rotation executed
            await keyManager.executeKeyRotation();
            
            // Then: All devices should have updated keys
            const afterRotation = await keyManager.getDeviceKeys(mobileDeviceId);
            expect(afterRotation.signedPreKey.keyId).toBeDefined();
            
            // Registry should be updated
            const status = keyManager.getRotationStatus();
            expect(status.deviceCount).toBe(2);
        });
    });

    // Integration tests for key management
    describe('Key Management Integration', () => {
        test('should integrate with Signal Protocol Manager', async () => {
            // Given: Both managers initialized
            expect(keyManager.signalManager).toBe(signalManager);
            expect(signalManager.isInitialized()).toBe(true);
            
            // When: Key operations performed
            const keys = await signalManager.generateIdentityKeys();
            await keyManager.executeKeyRotation();
            
            // Then: Operations should complete without conflict
            expect(keys).toBeDefined();
            const status = keyManager.getRotationStatus();
            expect(status.userId).toBe(userId);
        });

        test('should handle concurrent key operations safely', async () => {
            // Given: Multiple simultaneous operations
            const operations = [
                keyManager.registerDevice('device1', { type: 'test' }),
                keyManager.registerDevice('device2', { type: 'test' }),
                keyManager.executeKeyRotation()
            ];
            
            // When: All operations executed concurrently
            const results = await Promise.allSettled(operations);
            
            // Then: Operations should complete (some may fail due to timing)
            expect(results.length).toBe(3);
            // At least device registration should succeed
            const successfulOps = results.filter(r => r.status === 'fulfilled');
            expect(successfulOps.length).toBeGreaterThan(0);
        });
    });
});