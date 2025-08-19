// Test suite for Security Hardening (TestCase #12-15)
// HIPAA E2EE Chat System - Zero-Knowledge, Forward Secrecy, Replay Protection, MITM Protection

import SecurityHardening from '../client/js/security/SecurityHardening.js';
import SignalProtocolManager from '../client/js/encryption/SignalProtocolManager.js';

describe('Security Hardening Tests', () => {
    let securityManager, signalManager;
    const userId = 'doctor_alice_001';

    beforeEach(async () => {
        signalManager = new SignalProtocolManager(userId);
        await signalManager.initialize();
        
        securityManager = new SecurityHardening(userId, signalManager);
        await securityManager.initialize();
    });

    afterEach(async () => {
        await securityManager.cleanup();
        if (signalManager?.store) {
            await signalManager.store.secureDelete();
        }
    });

    // TestCase #12: Server Cannot Decrypt Messages (Zero-Knowledge Proof)
    describe('TestCase #12: Server Cannot Decrypt Messages', () => {
        test('should validate zero-knowledge architecture with encrypted message', async () => {
            // Given: Properly encrypted message
            const plainMessage = 'Patient John Doe has diabetes - confidential PHI';
            const encryptedMessage = await signalManager.encryptMessage('recipient_001', plainMessage);
            
            const messageData = {
                id: 'msg_001',
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                payload: encryptedMessage
            };

            // When: Validating zero-knowledge architecture
            const validation = await securityManager.validateZeroKnowledgeArchitecture(messageData);

            // Then: Should confirm server cannot decrypt
            expect(validation.hasPlaintextContent).toBe(false);
            expect(validation.hasEncryptedPayload).toBe(true);
            expect(validation.hasProperStructure).toBe(true);
            expect(validation.serverCannotDecrypt).toBe(true);
        });

        test('should detect zero-knowledge violation with plaintext content', async () => {
            // Given: Message with plaintext PHI
            const messageData = {
                id: 'msg_002',
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                message: 'Patient John Doe has diabetes', // PHI in plaintext
                payload: {
                    ciphertext: 'encrypted_data',
                    iv: 'init_vector',
                    tag: 'auth_tag'
                }
            };

            // When: Validating zero-knowledge architecture
            // Then: Should throw error for PHI exposure
            await expect(securityManager.validateZeroKnowledgeArchitecture(messageData))
                .rejects.toThrow('Zero-knowledge violation');
        });

        test('should verify server simulation cannot decrypt messages', async () => {
            // Given: Encrypted message data
            const encryptedMessage = await signalManager.encryptMessage('recipient_001', 'Secret medical data');
            const messageData = {
                id: 'msg_003',
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                payload: encryptedMessage
            };

            // When: Simulating server decryption attempt
            const serverCanDecrypt = await securityManager.simulateServerDecryption(messageData);

            // Then: Server should not be able to decrypt
            expect(serverCanDecrypt).toBe(false);
        });

        test('should detect readable content in ciphertext field', async () => {
            // Given: Message with readable text in ciphertext (encryption failure)
            const messageData = {
                id: 'msg_004',
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                payload: {
                    ciphertext: 'This is readable text instead of encrypted data',
                    iv: 'init_vector',
                    tag: 'auth_tag'
                }
            };

            // When: Simulating server decryption
            const serverCanDecrypt = await securityManager.simulateServerDecryption(messageData);

            // Then: Should detect that content is readable (encryption failed)
            expect(serverCanDecrypt).toBe(true);
        });

        test('should validate proper message structure', async () => {
            // Given: Message with proper encrypted structure
            const encryptedMessage = await signalManager.encryptMessage('recipient_001', 'Test message');
            const messageData = {
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                payload: encryptedMessage
            };

            // When: Validating structure
            const isValid = securityManager.validateMessageStructure(messageData);

            // Then: Should pass structure validation
            expect(isValid).toBe(true);
        });
    });

    // TestCase #13: Message Forward Secrecy
    describe('TestCase #13: Message Forward Secrecy', () => {
        test('should enforce forward secrecy through key deletion', async () => {
            // Given: Key used for encryption
            const keyId = 'test_key_001';
            const keyType = 'signed_pre_key';

            // When: Enforcing forward secrecy
            await securityManager.enforceForwardSecrecy(keyId, keyType);

            // Then: Key should be tracked for deletion
            const keyRecord = securityManager.forwardSecrecyTracker.get(keyId);
            expect(keyRecord).toBeDefined();
            expect(keyRecord.keyId).toBe(keyId);
            expect(keyRecord.keyType).toBe(keyType);
            expect(keyRecord.deleted).toBe(false);
            expect(keyRecord.scheduledDeletion).toBeGreaterThan(Date.now());
        });

        test('should securely delete expired keys', async () => {
            // Given: Key that needs to be deleted
            const keyId = 'test_key_002';
            
            // Create a test pre-key in storage
            const testKey = {
                keyId: keyId,
                pubKey: new Uint8Array([1, 2, 3]),
                privKey: new Uint8Array([4, 5, 6])
            };
            await signalManager.store.storePreKey(keyId, testKey);

            // When: Securely deleting the key
            await securityManager.securelyDeleteKey(keyId);

            // Then: Key should be removed from storage
            const verificationResult = await securityManager.verifyKeyDeletion(keyId);
            expect(verificationResult.deleted).toBe(true);
        });

        test('should validate forward secrecy maintenance', async () => {
            // Given: Multiple keys with some deleted
            const keys = ['key_001', 'key_002', 'key_003'];
            
            for (const keyId of keys) {
                await securityManager.enforceForwardSecrecy(keyId, 'test_key');
            }
            
            // Delete some keys
            await securityManager.securelyDeleteKey('key_001');
            await securityManager.securelyDeleteKey('key_002');

            // When: Validating forward secrecy
            const validation = await securityManager.validateForwardSecrecy();

            // Then: Should show proper key management
            expect(validation.totalKeys).toBe(3);
            expect(validation.deletedKeys).toBe(2);
            expect(validation.forwardSecrecyMaintained).toBe(true);
        });

        test('should verify key deletion prevents access', async () => {
            // Given: Key stored and then deleted
            const keyId = 'test_key_003';
            const testKey = {
                keyId: keyId,
                pubKey: new Uint8Array([7, 8, 9]),
                privKey: new Uint8Array([10, 11, 12])
            };
            
            await signalManager.store.storePreKey(keyId, testKey);
            
            // Verify key exists initially
            const initialKey = await signalManager.store.loadPreKey(keyId);
            expect(initialKey).toBeDefined();

            // When: Key is securely deleted
            await securityManager.securelyDeleteKey(keyId);

            // Then: Key should no longer be accessible
            const deletedKey = await signalManager.store.loadPreKey(keyId);
            expect(deletedKey).toBeUndefined();
        });

        test('should track security metrics for key rotations', async () => {
            // Given: Initial security metrics
            const initialMetrics = securityManager.getSecurityStatus();
            const initialRotations = initialMetrics.metrics.keyRotations;

            // When: Performing key rotations
            await securityManager.enforceForwardSecrecy('key_004', 'test');
            await securityManager.enforceForwardSecrecy('key_005', 'test');

            // Then: Metrics should be updated
            const updatedMetrics = securityManager.getSecurityStatus();
            expect(updatedMetrics.metrics.keyRotations).toBe(initialRotations + 2);
        });
    });

    // TestCase #14: Replay Attack Prevention
    describe('TestCase #14: Replay Attack Prevention', () => {
        test('should detect duplicate message ID replay attack', async () => {
            // Given: Original message
            const messageData = {
                id: 'unique_msg_001',
                type: 'encrypted_message',
                sender: 'attacker_001',
                recipient: userId,
                timestamp: Date.now(),
                payload: { ciphertext: 'test', iv: 'test', tag: 'test' }
            };

            // When: Processing message first time
            const firstResult = await securityManager.detectReplayAttack(messageData);
            expect(firstResult.isReplay).toBe(false);

            // When: Processing same message again (replay attack)
            const replayResult = await securityManager.detectReplayAttack(messageData);

            // Then: Should detect replay attack
            expect(replayResult.isReplay).toBe(true);
            expect(replayResult.reason).toBe('duplicate_message_id');
            expect(securityManager.securityMetrics.replayAttempts).toBe(1);
        });

        test('should detect duplicate content replay attack', async () => {
            // Given: Two messages with different IDs but same content
            const messageContent = { payload: { ciphertext: 'same_content', iv: 'same', tag: 'same' } };
            
            const message1 = {
                id: 'msg_001',
                type: 'encrypted_message',
                sender: 'attacker_001',
                recipient: userId,
                timestamp: Date.now(),
                ...messageContent
            };

            const message2 = {
                id: 'msg_002', // Different ID
                type: 'encrypted_message',
                sender: 'attacker_001',
                recipient: userId,
                timestamp: Date.now() + 1000,
                ...messageContent // Same content
            };

            // When: Processing both messages
            const firstResult = await securityManager.detectReplayAttack(message1);
            const replayResult = await securityManager.detectReplayAttack(message2);

            // Then: Second should be detected as replay
            expect(firstResult.isReplay).toBe(false);
            expect(replayResult.isReplay).toBe(true);
            expect(replayResult.reason).toBe('duplicate_content');
        });

        test('should detect stale timestamp replay attack', async () => {
            // Given: Message with old timestamp (older than 5 minutes)
            const staleMessage = {
                id: 'stale_msg_001',
                type: 'encrypted_message',
                sender: 'attacker_001',
                recipient: userId,
                timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
                payload: { ciphertext: 'test', iv: 'test', tag: 'test' }
            };

            // When: Processing stale message
            const result = await securityManager.detectReplayAttack(staleMessage);

            // Then: Should detect stale timestamp
            expect(result.isReplay).toBe(true);
            expect(result.reason).toBe('stale_timestamp');
            expect(result.messageAge).toBeGreaterThan(5 * 60 * 1000);
        });

        test('should accept fresh valid messages', async () => {
            // Given: Fresh, unique message
            const validMessage = {
                id: 'fresh_msg_001',
                type: 'encrypted_message',
                sender: 'legitimate_user_001',
                recipient: userId,
                timestamp: Date.now() - 1000, // 1 second ago (fresh)
                payload: { ciphertext: 'unique_content', iv: 'unique', tag: 'unique' }
            };

            // When: Processing valid message
            const result = await securityManager.detectReplayAttack(validMessage);

            // Then: Should accept message
            expect(result.isReplay).toBe(false);
            expect(result.reason).toBe('message_accepted');
            expect(result.messageId).toBe('fresh_msg_001');
        });

        test('should maintain message history cleanup', async () => {
            // Given: Large number of messages to trigger cleanup
            const messages = [];
            for (let i = 0; i < 1005; i++) { // Exceed 1000 limit
                messages.push({
                    id: `msg_${i}`,
                    type: 'encrypted_message',
                    sender: 'bulk_sender',
                    recipient: userId,
                    timestamp: Date.now() + i,
                    payload: { ciphertext: `content_${i}`, iv: 'iv', tag: 'tag' }
                });
            }

            // When: Processing all messages
            for (const message of messages) {
                await securityManager.detectReplayAttack(message);
            }

            // Then: History should be cleaned up to 1000 entries
            expect(securityManager.messageHistory.size).toBeLessThanOrEqual(1000);
        });
    });

    // TestCase #15: Man-in-the-Middle Protection
    describe('TestCase #15: Man-in-the-Middle Protection', () => {
        test('should detect MITM attack with unknown key fingerprint', async () => {
            // Given: Known sender with previously verified keys
            const senderId = 'trusted_sender_001';
            const knownKeyData = {
                pubKey: new Uint8Array([1, 2, 3, 4, 5]),
                keyId: 'known_key_001',
                timestamp: Date.now()
            };

            // Store known key
            const knownFingerprint = await securityManager.calculateKeyFingerprint(knownKeyData);
            await securityManager.storeVerifiedKey(senderId, knownFingerprint, knownKeyData);

            // When: Receiving key exchange with different key (potential MITM)
            const suspiciousKeyData = {
                pubKey: new Uint8Array([6, 7, 8, 9, 10]), // Different key
                keyId: 'suspicious_key_001',
                timestamp: Date.now()
            };

            const mitmeResult = await securityManager.detectMITMAttack(suspiciousKeyData, senderId);

            // Then: Should detect potential MITM
            expect(mitmeResult.isMITM).toBe(true);
            expect(mitmeResult.reason).toBe('unknown_key_fingerprint');
            expect(securityManager.securityMetrics.mitmeAttempts).toBe(1);
        });

        test('should accept known verified keys', async () => {
            // Given: Known sender and key
            const senderId = 'trusted_sender_002';
            const trustedKeyData = {
                pubKey: new Uint8Array([11, 12, 13, 14, 15]),
                keyId: 'trusted_key_001',
                timestamp: Date.now()
            };

            // Pre-verify the key
            const fingerprint = await securityManager.calculateKeyFingerprint(trustedKeyData);
            await securityManager.storeVerifiedKey(senderId, fingerprint, trustedKeyData);

            // When: Receiving key exchange with known key
            const mitmeResult = await securityManager.detectMITMAttack(trustedKeyData, senderId);

            // Then: Should accept known key
            expect(mitmeResult.isMITM).toBe(false);
            expect(mitmeResult.reason).toBe('key_verified');
            expect(mitmeResult.keyFingerprint).toBe(fingerprint);
        });

        test('should handle first-time key exchange with manual verification', async () => {
            // Given: New sender with no previous keys
            const newSenderId = 'new_sender_001';
            const newKeyData = {
                pubKey: new Uint8Array([16, 17, 18, 19, 20]),
                keyId: 'new_key_001',
                timestamp: Date.now()
            };

            // When: First key exchange
            const mitmeResult = await securityManager.detectMITMAttack(newKeyData, newSenderId);

            // Then: Should require manual verification but pass (auto-approved in test)
            expect(mitmeResult.isMITM).toBe(false);
            expect(mitmeResult.reason).toBe('key_verified');
            
            // Key should now be stored
            const storedKeys = securityManager.keyVerificationData.get(newSenderId);
            expect(storedKeys).toBeDefined();
            expect(storedKeys.length).toBe(1);
        });

        test('should verify key signatures when available', async () => {
            // Given: Key exchange with valid signature
            const keyDataWithSignature = {
                pubKey: new Uint8Array([21, 22, 23, 24, 25]),
                keyId: 'signed_key_001',
                timestamp: Date.now(),
                signature: new Uint8Array([1, 2, 3, 4]) // Mock signature
            };

            // When: Verifying key with signature
            const isValidSignature = await securityManager.verifyKeySignature(keyDataWithSignature);

            // Then: Should validate signature
            expect(isValidSignature).toBe(true);
        });

        test('should calculate consistent key fingerprints', async () => {
            // Given: Same key data
            const keyData = {
                pubKey: new Uint8Array([26, 27, 28, 29, 30]),
                keyId: 'fingerprint_test_001',
                timestamp: Date.now()
            };

            // When: Calculating fingerprint multiple times
            const fingerprint1 = await securityManager.calculateKeyFingerprint(keyData);
            const fingerprint2 = await securityManager.calculateKeyFingerprint(keyData);

            // Then: Should produce consistent results
            expect(fingerprint1).toBe(fingerprint2);
            expect(typeof fingerprint1).toBe('string');
            expect(fingerprint1.length).toBeGreaterThan(0);
        });

        test('should limit stored verified keys per sender', async () => {
            // Given: Sender with many key verifications
            const senderId = 'prolific_sender_001';
            
            // When: Adding more than 5 verified keys
            for (let i = 0; i < 7; i++) {
                const keyData = {
                    pubKey: new Uint8Array([i, i+1, i+2, i+3, i+4]),
                    keyId: `key_${i}`,
                    timestamp: Date.now() + i
                };
                
                const fingerprint = await securityManager.calculateKeyFingerprint(keyData);
                await securityManager.storeVerifiedKey(senderId, fingerprint, keyData);
            }

            // Then: Should only keep last 5 keys
            const storedKeys = securityManager.keyVerificationData.get(senderId);
            expect(storedKeys.length).toBe(5);
        });
    });

    // Integration tests
    describe('Security Integration Tests', () => {
        test('should validate complete message security', async () => {
            // Given: Complete message flow
            const plainMessage = 'Confidential patient data';
            const encryptedMessage = await signalManager.encryptMessage('recipient_001', plainMessage);
            
            const messageData = {
                id: 'integration_msg_001',
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                payload: encryptedMessage
            };

            // When: Complete security validation
            const validation = await securityManager.validateMessage(messageData);

            // Then: All security checks should pass
            expect(validation.overallValid).toBe(true);
            expect(validation.zeroKnowledge.serverCannotDecrypt).toBe(true);
            expect(validation.replayDetection.isReplay).toBe(false);
        });

        test('should validate complete key exchange security', async () => {
            // Given: Key exchange data
            const keyData = {
                pubKey: new Uint8Array([31, 32, 33, 34, 35]),
                keyId: 'integration_key_001',
                timestamp: Date.now(),
                signature: new Uint8Array([5, 6, 7, 8])
            };

            const senderId = 'integration_sender_001';

            // When: Complete key exchange validation
            const validation = await securityManager.validateKeyExchange(keyData, senderId);

            // Then: Key exchange should be secure
            expect(validation.valid).toBe(true);
            expect(validation.mitmeProtection.isMITM).toBe(false);
        });

        test('should maintain security metrics across operations', async () => {
            // Given: Multiple security operations
            const initialStatus = securityManager.getSecurityStatus();

            // When: Performing various security operations
            await securityManager.enforceForwardSecrecy('metric_key_001', 'test');
            
            const messageData = {
                id: 'metric_msg_001',
                type: 'encrypted_message',
                sender: userId,
                recipient: 'recipient_001',
                timestamp: Date.now(),
                payload: { ciphertext: 'test', iv: 'test', tag: 'test' }
            };
            
            await securityManager.detectReplayAttack(messageData);
            
            // Then: Metrics should be updated
            const finalStatus = securityManager.getSecurityStatus();
            expect(finalStatus.metrics.keyRotations).toBeGreaterThan(initialStatus.metrics.keyRotations);
            expect(finalStatus.metrics.messagesProcessed).toBeGreaterThan(initialStatus.metrics.messagesProcessed);
        });
    });
});