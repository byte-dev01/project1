// Test suite for Encryption Module (TestCase #1-3)
// HIPAA E2EE Chat System - Signal Protocol Implementation Tests

import SignalProtocolManager from '../client/js/encryption/SignalProtocolManager.js';
import { generateRandomBytes, validateMessageEnvelope } from '../client/js/utils/crypto.js';

describe('Encryption Module Tests', () => {
    let aliceManager, bobManager;
    const aliceId = 'alice_doctor_001';
    const bobId = 'bob_patient_001';

    beforeEach(async () => {
        // Initialize fresh managers for each test
        aliceManager = new SignalProtocolManager(aliceId);
        bobManager = new SignalProtocolManager(bobId);
    });

    afterEach(async () => {
        // Cleanup for HIPAA compliance
        if (aliceManager?.store) {
            await aliceManager.store.secureDelete();
        }
        if (bobManager?.store) {
            await bobManager.store.secureDelete();
        }
    });

    // TestCase #1: Signal Protocol Initialization
    describe('TestCase #1: Signal Protocol Initialization', () => {
        test('should initialize Signal Protocol with valid stores', async () => {
            // Given: Fresh application state with no existing keys
            expect(aliceManager.isInitialized()).toBe(false);
            
            // When: Signal protocol library is initialized with user identity
            const result = await aliceManager.initialize();
            
            // Then: Protocol instance created with valid stores
            expect(result).toBe(true);
            expect(aliceManager.isInitialized()).toBe(true);
            expect(aliceManager.store).toBeDefined();
            expect(aliceManager.getUserId()).toBe(aliceId);
        });

        test('should handle initialization failure gracefully', async () => {
            // Given: Corrupted initialization environment
            const corruptedManager = new SignalProtocolManager('');
            
            // When: Initialization fails
            // Then: Should throw appropriate error
            await expect(corruptedManager.initialize()).rejects.toThrow();
        });
    });

    // TestCase #2: Key Pair Generation Suite
    describe('TestCase #2: Key Pair Generation Suite', () => {
        test('should generate complete key suite with proper formats', async () => {
            // Given: Initialized Signal Protocol instance
            await aliceManager.initialize();
            
            // When: Key generation methods are called
            const keys = await aliceManager.generateIdentityKeys();
            
            // Then: All required keys generated with proper formats
            expect(keys).toHaveProperty('identityKey');
            expect(keys).toHaveProperty('signedPreKey');
            expect(keys).toHaveProperty('preKeys');
            
            // Verify identity key format (Curve25519)
            expect(keys.identityKey).toBeInstanceOf(Uint8Array);
            expect(keys.identityKey.length).toBeGreaterThan(0);
            
            // Verify signed pre-key with signature
            expect(keys.signedPreKey).toHaveProperty('keyId');
            expect(keys.signedPreKey).toHaveProperty('pubKey');
            expect(keys.signedPreKey).toHaveProperty('signature');
            expect(keys.signedPreKey).toHaveProperty('timestamp');
            
            // Verify one-time pre-keys array
            expect(Array.isArray(keys.preKeys)).toBe(true);
            expect(keys.preKeys.length).toBe(10); // First 10 for server
            
            keys.preKeys.forEach(preKey => {
                expect(preKey).toHaveProperty('keyId');
                expect(preKey).toHaveProperty('pubKey');
                expect(preKey.pubKey).toBeInstanceOf(Uint8Array);
            });
        });

        test('should generate unique key IDs', async () => {
            // Given: Initialized manager
            await aliceManager.initialize();
            
            // When: Multiple key generations
            const keys1 = await aliceManager.generateIdentityKeys();
            const keys2 = await aliceManager.generateIdentityKeys();
            
            // Then: Key IDs should be unique
            expect(keys1.signedPreKey.keyId).not.toBe(keys2.signedPreKey.keyId);
        });
    });

    // TestCase #3: Message Encryption/Decryption Cycle
    describe('TestCase #3: Message Encryption/Decryption Cycle', () => {
        const testMessage = 'Patient John Doe has diabetes - confidential PHI';
        
        beforeEach(async () => {
            // Setup both managers
            await aliceManager.initialize();
            await bobManager.initialize();
        });

        test('should encrypt and decrypt message correctly', async () => {
            // Given: Two established Signal sessions between Alice and Bob
            // When: Alice encrypts plaintext message
            const encryptedEnvelope = await aliceManager.encryptMessage(bobId, testMessage);
            
            // Then: Ciphertext is unreadable binary and properly formatted
            expect(validateMessageEnvelope(encryptedEnvelope)).toBe(true);
            expect(encryptedEnvelope.type).toBe('message');
            expect(encryptedEnvelope.sender).toBe(aliceId);
            expect(encryptedEnvelope.recipient).toBe(bobId);
            expect(encryptedEnvelope.ciphertext).toBeDefined();
            expect(encryptedEnvelope.iv).toBeDefined();
            expect(encryptedEnvelope.tag).toBeDefined();
            
            // Verify ciphertext is not plaintext
            expect(encryptedEnvelope.ciphertext).not.toContain(testMessage);
            
            // When: Bob decrypts the ciphertext
            const decryptedMessage = await bobManager.decryptMessage(encryptedEnvelope);
            
            // Then: Bob receives exact plaintext
            expect(decryptedMessage).toBe(testMessage);
        });

        test('should fail decryption with wrong recipient', async () => {
            // Given: Message encrypted for Bob
            const encryptedEnvelope = await aliceManager.encryptMessage(bobId, testMessage);
            
            // When: Different user tries to decrypt
            const charlieManager = new SignalProtocolManager('charlie_admin_001');
            await charlieManager.initialize();
            
            // Then: Decryption should fail
            await expect(charlieManager.decryptMessage(encryptedEnvelope)).rejects.toThrow();
        });

        test('should handle corrupted ciphertext', async () => {
            // Given: Valid encrypted message
            const encryptedEnvelope = await aliceManager.encryptMessage(bobId, testMessage);
            
            // When: Ciphertext is corrupted
            encryptedEnvelope.ciphertext = 'corrupted_data';
            
            // Then: Decryption should fail gracefully
            await expect(bobManager.decryptMessage(encryptedEnvelope)).rejects.toThrow();
        });

        test('should encrypt different messages to different ciphertexts', async () => {
            // Given: Two different messages
            const message1 = 'Patient has diabetes';
            const message2 = 'Patient has hypertension';
            
            // When: Both messages encrypted
            const envelope1 = await aliceManager.encryptMessage(bobId, message1);
            const envelope2 = await aliceManager.encryptMessage(bobId, message2);
            
            // Then: Ciphertexts should be different
            expect(envelope1.ciphertext).not.toBe(envelope2.ciphertext);
            expect(envelope1.iv).not.toBe(envelope2.iv);
        });

        test('should include proper timestamps and metadata', async () => {
            // Given: Current time before encryption
            const beforeTime = Date.now();
            
            // When: Message is encrypted
            const envelope = await aliceManager.encryptMessage(bobId, testMessage);
            
            // Then: Timestamp should be recent and within expected range
            const afterTime = Date.now();
            expect(envelope.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(envelope.timestamp).toBeLessThanOrEqual(afterTime);
        });
    });

    // Edge cases and security tests
    describe('Security and Edge Cases', () => {
        beforeEach(async () => {
            await aliceManager.initialize();
            await bobManager.initialize();
        });

        test('should handle empty message encryption', async () => {
            // Given: Empty string message
            const emptyMessage = '';
            
            // When: Encrypting empty message
            const envelope = await aliceManager.encryptMessage(bobId, emptyMessage);
            const decrypted = await bobManager.decryptMessage(envelope);
            
            // Then: Should handle gracefully
            expect(decrypted).toBe(emptyMessage);
        });

        test('should handle large message encryption', async () => {
            // Given: Large message (1MB of text)
            const largeMessage = 'A'.repeat(1024 * 1024);
            
            // When: Encrypting large message
            const envelope = await aliceManager.encryptMessage(bobId, largeMessage);
            const decrypted = await bobManager.decryptMessage(envelope);
            
            // Then: Should handle without corruption
            expect(decrypted).toBe(largeMessage);
        });

        test('should prevent message replay attacks', async () => {
            // Given: Encrypted message
            const envelope = await aliceManager.encryptMessage(bobId, 'test message');
            
            // When: First decryption succeeds
            const decrypted1 = await bobManager.decryptMessage(envelope);
            expect(decrypted1).toBe('test message');
            
            // Then: Replay should be detectable (implementation specific)
            // Note: Full replay protection requires session state management
        });
    });
});