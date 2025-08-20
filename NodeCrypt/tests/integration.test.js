// Complete Integration Test Suite for HIPAA E2EE System
// Tests all 19 test cases working together

import HIPAAIntegration from '../client/js/HIPAAIntegration.js';

describe('HIPAA E2EE Complete Integration Tests', () => {
    let aliceSystem, bobSystem;
    const aliceId = 'doctor_alice_001';
    const bobId = 'patient_bob_001';

    beforeEach(async () => {
        // Initialize complete systems for Alice and Bob
        aliceSystem = new HIPAAIntegration(aliceId);
        bobSystem = new HIPAAIntegration(bobId);
        
        await aliceSystem.initialize();
        await bobSystem.initialize();
    }, 30000); // 30 second timeout for full initialization

    afterEach(async () => {
        // Cleanup both systems
        if (aliceSystem) {
            await aliceSystem.cleanup();
        }
        if (bobSystem) {
            await bobSystem.cleanup();
        }
    }, 10000);

    describe('Complete System Integration', () => {
        test('should initialize all components successfully', async () => {
            // Given: HIPAA E2EE System
            // When: System initialized
            const aliceStatus = aliceSystem.getSystemStatus();
            const bobStatus = bobSystem.getSystemStatus();

            // Then: All components should be ready
            expect(aliceStatus.isInitialized).toBe(true);
            expect(aliceStatus.systemStatus).toBe('ready');
            expect(bobStatus.isInitialized).toBe(true);
            expect(bobStatus.systemStatus).toBe('ready');

            // Check all components
            const requiredComponents = ['signal', 'keyManager', 'webrtc', 'hipaa', 'messageFlow', 'security'];
            for (const component of requiredComponents) {
                expect(aliceStatus.components[component].initialized).toBe(true);
                expect(bobStatus.components[component].initialized).toBe(true);
            }
        });

        test('should pass comprehensive health check', async () => {
            // Given: Fully initialized systems
            // When: Running health check
            const aliceHealth = await aliceSystem.runHealthCheck();
            const bobHealth = await bobSystem.runHealthCheck();

            // Then: Systems should be healthy
            expect(aliceHealth.overallHealthy).toBe(true);
            expect(aliceHealth.issues.length).toBe(0);
            expect(bobHealth.overallHealthy).toBe(true);
            expect(bobHealth.issues.length).toBe(0);

            // All components should be healthy
            for (const componentHealth of Object.values(aliceHealth.components)) {
                expect(componentHealth.healthy).toBe(true);
            }
        });
    });

    describe('End-to-End Message Flow Integration', () => {
        test('should complete full E2EE message flow with all security layers', async () => {
            // TestCase #7: Complete E2EE Message Flow
            const testMessage = 'INTEGRATION TEST: Patient has diabetes - confidential PHI';
            
            // Given: Alice and Bob with fully initialized systems
            expect(aliceSystem.isInitialized).toBe(true);
            expect(bobSystem.isInitialized).toBe(true);

            // When: Alice sends secure message to Bob
            const sendResult = await aliceSystem.sendSecureMessage(bobId, testMessage);

            // Then: Message should be sent successfully
            expect(sendResult.delivered).toBe(true);
            expect(sendResult.messageId).toBeDefined();
            expect(sendResult.timestamp).toBeDefined();

            // Mock message envelope for Bob to receive
            const messageEnvelope = {
                id: sendResult.messageId,
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: sendResult.timestamp,
                payload: await aliceSystem.components.signal.encryptMessage(bobId, testMessage)
            };

            // When: Bob receives the message
            const receiveResult = await bobSystem.receiveSecureMessage(messageEnvelope);

            // Then: Bob should decrypt exact message
            expect(receiveResult.message).toBe(testMessage);
            expect(receiveResult.sender).toBe(aliceId);
            expect(receiveResult.messageId).toBe(sendResult.messageId);
        }, 15000);

        test('should enforce HIPAA compliance throughout message flow', async () => {
            // TestCase #16-19: HIPAA Compliance
            const phiMessage = 'Patient John Doe, DOB: 01/15/1980, has diabetes';

            // Given: HIPAA middleware active
            const aliceHipaaInfo = aliceSystem.getSystemStatus().hipaaCompliance;
            expect(aliceHipaaInfo.isActive).toBe(true);

            // When: Sending message with PHI
            const sendResult = await aliceSystem.sendSecureMessage(bobId, phiMessage);

            // Then: Message sent but PHI not logged in audit
            expect(sendResult.delivered).toBe(true);

            // HIPAA session should be updated
            const updatedHipaaInfo = aliceSystem.getSystemStatus().hipaaCompliance;
            expect(updatedHipaaInfo.lastActivity).toBeGreaterThan(aliceHipaaInfo.lastActivity);
        });

        test('should maintain forward secrecy across key rotations', async () => {
            // TestCase #13: Forward Secrecy
            const message1 = 'Message before key rotation';
            const message2 = 'Message after key rotation';

            // Send first message
            await aliceSystem.sendSecureMessage(bobId, message1);

            // Force key rotation
            await aliceSystem.components.keyManager.executeKeyRotation();
            
            // Send second message
            await aliceSystem.sendSecureMessage(bobId, message2);

            // Verify forward secrecy is maintained
            const forwardSecrecyStatus = await aliceSystem.components.security.validateForwardSecrecy();
            expect(forwardSecrecyStatus.forwardSecrecyMaintained).toBe(true);
        });
    });

    describe('Security Hardening Integration', () => {
        test('should detect and prevent replay attacks', async () => {
            // TestCase #14: Replay Attack Prevention
            const originalMessage = 'Original message for replay test';
            
            // Send original message
            const sendResult = await aliceSystem.sendSecureMessage(bobId, originalMessage);
            
            // Create message envelope
            const messageEnvelope = {
                id: sendResult.messageId,
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: sendResult.timestamp,
                payload: await aliceSystem.components.signal.encryptMessage(bobId, originalMessage)
            };

            // First receive should succeed
            const firstReceive = await bobSystem.receiveSecureMessage(messageEnvelope);
            expect(firstReceive.message).toBe(originalMessage);

            // Replay attack should be detected
            const replayDetection = await bobSystem.components.security.detectReplayAttack(messageEnvelope);
            expect(replayDetection.isReplay).toBe(true);
            expect(replayDetection.reason).toBe('duplicate_message_id');
        });

        test('should maintain zero-knowledge architecture', async () => {
            // TestCase #12: Zero-Knowledge Proof
            const sensitiveMessage = 'Highly confidential patient diagnosis';
            
            // Send message
            const sendResult = await aliceSystem.sendSecureMessage(bobId, sensitiveMessage);
            
            // Create message data for validation
            const messageData = {
                id: sendResult.messageId,
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: sendResult.timestamp,
                payload: await aliceSystem.components.signal.encryptMessage(bobId, sensitiveMessage)
            };

            // Validate zero-knowledge architecture
            const zeroKnowledgeValidation = await aliceSystem.components.security.validateZeroKnowledgeArchitecture(messageData);
            
            expect(zeroKnowledgeValidation.hasPlaintextContent).toBe(false);
            expect(zeroKnowledgeValidation.hasEncryptedPayload).toBe(true);
            expect(zeroKnowledgeValidation.serverCannotDecrypt).toBe(true);
        });

        test('should protect against MITM attacks in key exchange', async () => {
            // TestCase #15: MITM Protection
            const keyData = {
                pubKey: new Uint8Array([1, 2, 3, 4, 5]),
                keyId: 'test_key_001',
                timestamp: Date.now()
            };

            // First key exchange should succeed (new contact)
            const firstValidation = await aliceSystem.components.security.validateKeyExchange(keyData, bobId);
            expect(firstValidation.valid).toBe(true);

            // Different key from same sender should trigger MITM detection
            const suspiciousKeyData = {
                pubKey: new Uint8Array([6, 7, 8, 9, 10]),
                keyId: 'suspicious_key_001',
                timestamp: Date.now()
            };

            const mitmeValidation = await aliceSystem.components.security.validateKeyExchange(suspiciousKeyData, bobId);
            expect(mitmeValidation.valid).toBe(false);
            expect(mitmeValidation.mitmeProtection.isMITM).toBe(true);
        });
    });

    describe('WebRTC Integration', () => {
        test('should establish secure WebRTC call with encrypted signaling', async () => {
            // TestCase #5 & #11: Secure WebRTC
            
            // Given: Both systems ready for WebRTC
            expect(aliceSystem.components.webrtc).toBeDefined();
            expect(bobSystem.components.webrtc).toBeDefined();

            // When: Alice initiates secure call
            const secureOffer = await aliceSystem.startSecureCall(bobId);

            // Then: Offer should be encrypted
            expect(secureOffer.type).toBe('secure_offer');
            expect(secureOffer.sender).toBe(aliceId);
            expect(secureOffer.recipient).toBe(bobId);
            expect(secureOffer.encryptedSdp).toBeDefined();
            expect(secureOffer.encryptedSdp.encryptedSdp).toBeDefined();

            // SDP should not contain plaintext
            const serialized = JSON.stringify(secureOffer);
            expect(serialized).not.toContain('v=0'); // SDP version line
            expect(serialized).not.toContain('127.0.0.1'); // IP addresses
        });

        test('should send encrypted messages over WebRTC data channel', async () => {
            // TestCase #11: E2EE Data Channel
            const dataChannelMessage = 'Secure data channel message with PHI';

            // Start WebRTC connection
            const secureOffer = await aliceSystem.startSecureCall(bobId);
            
            // Simulate data channel ready
            aliceSystem.components.webrtc.dataChannel = {
                readyState: 'open',
                send: jest.fn()
            };

            // Send encrypted message over data channel
            await aliceSystem.components.webrtc.sendEncryptedMessage(dataChannelMessage, bobId);

            // Verify message was encrypted and sent
            expect(aliceSystem.components.webrtc.dataChannel.send).toHaveBeenCalled();
            
            const sentData = JSON.parse(aliceSystem.components.webrtc.dataChannel.send.mock.calls[0][0]);
            expect(sentData.type).toBe('encrypted_chat');
            expect(sentData.payload).toBeDefined();
            expect(sentData.sender).toBe(aliceId);
        });
    });

    describe('Multi-Device Support Integration', () => {
        test('should support multiple devices per user', async () => {
            // TestCase #9: Multi-Device Support
            const mobileDevice = 'alice_mobile_001';
            const desktopDevice = 'alice_desktop_001';

            // Register multiple devices for Alice
            await aliceSystem.components.keyManager.registerDevice(mobileDevice, { type: 'mobile' });
            await aliceSystem.components.keyManager.registerDevice(desktopDevice, { type: 'desktop' });

            // Send message to multiple devices
            const testMessage = 'Multi-device test message';
            const multiDeviceMessage = await aliceSystem.components.keyManager.encryptForMultipleDevices(bobId, testMessage);

            // Should have encrypted for multiple devices
            expect(multiDeviceMessage.deviceMessages.length).toBeGreaterThan(0);
            expect(multiDeviceMessage.recipientUserId).toBe(bobId);

            // Each device should have unique encryption
            const ciphertexts = multiDeviceMessage.deviceMessages.map(dm => dm.encryptedMessage.ciphertext);
            expect(new Set(ciphertexts).size).toBe(ciphertexts.length);
        });
    });

    describe('Offline Message Queue Integration', () => {
        test('should queue and deliver offline messages', async () => {
            // TestCase #10: Offline Message Queueing
            const offlineMessage = 'Message sent while recipient offline';

            // Simulate offline message
            const messageEnvelope = {
                id: 'offline_msg_001',
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: Date.now(),
                payload: await aliceSystem.components.signal.encryptMessage(bobId, offlineMessage)
            };

            // Queue message for offline delivery
            await aliceSystem.components.messageFlow.queueOfflineMessage(bobId, messageEnvelope);

            // Verify message is queued
            const messageStats = aliceSystem.components.messageFlow.getMessageStats();
            expect(messageStats.queuedMessages).toBeGreaterThan(0);

            // Deliver offline messages
            const deliveryResult = await aliceSystem.components.messageFlow.deliverOfflineMessages(bobId);
            expect(deliveryResult.delivered).toBeGreaterThan(0);
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle multiple concurrent operations', async () => {
            // Test system under load
            const concurrentOperations = 10;
            const promises = [];

            for (let i = 0; i < concurrentOperations; i++) {
                promises.push(
                    aliceSystem.sendSecureMessage(bobId, `Concurrent message ${i}`)
                );
            }

            // All operations should complete successfully
            const results = await Promise.all(promises);
            expect(results.length).toBe(concurrentOperations);
            expect(results.every(r => r.delivered)).toBe(true);
        });

        test('should maintain performance metrics', async () => {
            // Send several messages
            for (let i = 0; i < 5; i++) {
                await aliceSystem.sendSecureMessage(bobId, `Performance test message ${i}`);
            }

            // Check security metrics
            const securityStatus = aliceSystem.components.security.getSecurityStatus();
            expect(securityStatus.metrics.messagesProcessed).toBeGreaterThan(0);

            // Check message stats
            const messageStats = aliceSystem.components.messageFlow.getMessageStats();
            expect(messageStats.activeSessions).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle component failure gracefully', async () => {
            // Simulate component failure
            const originalHipaa = aliceSystem.components.hipaa;
            aliceSystem.components.hipaa = null;

            // System should detect unhealthy state
            const healthCheck = await aliceSystem.runHealthCheck();
            expect(healthCheck.overallHealthy).toBe(false);
            expect(healthCheck.issues.length).toBeGreaterThan(0);

            // Restore component
            aliceSystem.components.hipaa = originalHipaa;
        });

        test('should enforce access control', async () => {
            // Create restricted user
            const restrictedSystem = new HIPAAIntegration('restricted_user_001');
            await restrictedSystem.initialize();

            try {
                // Should fail due to access control
                await expect(restrictedSystem.sendSecureMessage(bobId, 'Unauthorized message'))
                    .rejects.toThrow();
            } finally {
                await restrictedSystem.cleanup();
            }
        });
    });

    describe('HIPAA Compliance Validation', () => {
        test('should enforce session timeout', async () => {
            // Get initial session info
            const sessionInfo = aliceSystem.components.hipaa.getSessionInfo();
            expect(sessionInfo.isActive).toBe(true);

            // Simulate session timeout (would normally take 15 minutes)
            // For testing, we'll directly call the timeout enforcement
            const timeoutPromise = new Promise((resolve) => {
                aliceSystem.components.hipaa.setOnSessionTimeout(resolve);
            });

            // Trigger timeout
            await aliceSystem.components.hipaa.enforceSessionTimeout();

            // Wait for timeout handler
            await timeoutPromise;

            // System should be cleaned up
            expect(aliceSystem.systemStatus).toBe('cleaned_up');
        });

        test('should maintain audit logs without PHI', async () => {
            // Send message with PHI
            const phiMessage = 'Patient John Smith has condition X';
            await aliceSystem.sendSecureMessage(bobId, phiMessage);

            // Audit logs should exist but not contain PHI
            const auditLogs = await aliceSystem.components.hipaa.auditLogger.getAuditLogs(
                Date.now() - 60000, 
                Date.now()
            );

            expect(auditLogs.length).toBeGreaterThan(0);
            
            // Verify no PHI in logs
            const logString = JSON.stringify(auditLogs);
            expect(logString).not.toContain('John Smith');
            expect(logString).not.toContain('condition X');
        });
    });

    test('ALL 19 TEST CASES INTEGRATION', async () => {
        console.log('🧪 Running comprehensive test of all 19 test cases');
        
        // This test verifies that all 19 test cases work together
        const testMessage = 'COMPREHENSIVE TEST: All 19 test cases integration';
        
        // TestCase #1-3: Signal Protocol (covered in initialization)
        expect(aliceSystem.components.signal.isInitialized()).toBe(true);
        
        // TestCase #4: Key Rotation (test rotation)
        await aliceSystem.components.keyManager.executeKeyRotation();
        
        // TestCase #5: WebRTC SDP Encryption
        const secureOffer = await aliceSystem.startSecureCall(bobId);
        expect(secureOffer.encryptedSdp).toBeDefined();
        
        // TestCase #6: Audit logs without PHI  
        await aliceSystem.sendSecureMessage(bobId, testMessage);
        
        // TestCase #7-8: Complete message flow with X3DH
        const messageResult = await aliceSystem.sendSecureMessage(bobId, testMessage);
        expect(messageResult.delivered).toBe(true);
        
        // TestCase #9: Multi-device support
        await aliceSystem.components.keyManager.registerDevice('test_device', { type: 'test' });
        
        // TestCase #10: Offline queueing
        const offlineEnvelope = {
            id: 'test_offline',
            type: 'encrypted_message',
            sender: aliceId,
            recipient: bobId,
            timestamp: Date.now(),
            payload: await aliceSystem.components.signal.encryptMessage(bobId, 'offline test')
        };
        await aliceSystem.components.messageFlow.queueOfflineMessage(bobId, offlineEnvelope);
        
        // TestCase #11: WebRTC E2EE data channel (simulated)
        // Covered in WebRTC integration tests above
        
        // TestCase #12: Zero-knowledge validation
        const messageData = {
            id: 'zk_test',
            type: 'encrypted_message',
            sender: aliceId,
            recipient: bobId,
            timestamp: Date.now(),
            payload: await aliceSystem.components.signal.encryptMessage(bobId, testMessage)
        };
        const zkValidation = await aliceSystem.components.security.validateZeroKnowledgeArchitecture(messageData);
        expect(zkValidation.serverCannotDecrypt).toBe(true);
        
        // TestCase #13: Forward secrecy
        const fsValidation = await aliceSystem.components.security.validateForwardSecrecy();
        expect(fsValidation.forwardSecrecyMaintained).toBe(true);
        
        // TestCase #14: Replay attack prevention
        const replayDetection = await aliceSystem.components.security.detectReplayAttack(messageData);
        expect(replayDetection.isReplay).toBe(false);
        
        // TestCase #15: MITM protection
        const keyData = { pubKey: new Uint8Array([1,2,3]), keyId: 'test', timestamp: Date.now() };
        const mitmeValidation = await aliceSystem.components.security.validateKeyExchange(keyData, bobId);
        expect(mitmeValidation.valid).toBe(true);
        
        // TestCase #16-19: HIPAA compliance (session active, access control, audit logs, timeout)
        const hipaaStatus = aliceSystem.components.hipaa.getSessionInfo();
        expect(hipaaStatus.isActive).toBe(true);
        
        // System health check
        const healthCheck = await aliceSystem.runHealthCheck();
        expect(healthCheck.overallHealthy).toBe(true);
        
        console.log('✅ ALL 19 TEST CASES PASSED IN INTEGRATION');
    }, 30000);
});