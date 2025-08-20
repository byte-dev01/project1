// Test suite for Message Flow (TestCase #7-8, #10)
// HIPAA E2EE Chat System - Complete Message Flow, X3DH, and Offline Queueing Tests

import MessageFlowManager from '../client/js/messaging/MessageFlowManager.js';
import SignalProtocolManager from '../client/js/encryption/SignalProtocolManager.js';
import KeyRotationManager from '../client/js/keymanagement/KeyRotationManager.js';

describe('Message Flow Tests', () => {
    let aliceFlow, bobFlow;
    let aliceSignal, bobSignal;
    let aliceKeyManager, bobKeyManager;
    const aliceId = 'doctor_alice_001';
    const bobId = 'patient_bob_001';

    beforeEach(async () => {
        // Initialize Signal Protocol managers
        aliceSignal = new SignalProtocolManager(aliceId);
        bobSignal = new SignalProtocolManager(bobId);
        await aliceSignal.initialize();
        await bobSignal.initialize();

        // Initialize Key managers
        aliceKeyManager = new KeyRotationManager(aliceId, aliceSignal);
        bobKeyManager = new KeyRotationManager(bobId, bobSignal);
        await aliceKeyManager.initialize();
        await bobKeyManager.initialize();

        // Initialize Message Flow managers
        aliceFlow = new MessageFlowManager(aliceId, aliceSignal, aliceKeyManager);
        bobFlow = new MessageFlowManager(bobId, bobSignal, bobKeyManager);
        await aliceFlow.initialize();
        await bobFlow.initialize();
    });

    afterEach(async () => {
        // Cleanup all managers
        await aliceFlow.cleanup();
        await bobFlow.cleanup();
        await aliceKeyManager.cleanup();
        await bobKeyManager.cleanup();
        
        if (aliceSignal?.store) {
            await aliceSignal.store.secureDelete();
        }
        if (bobSignal?.store) {
            await bobSignal.store.secureDelete();
        }
    });

    // TestCase #7: Complete E2EE Message Flow
    describe('TestCase #7: Complete E2EE Message Flow', () => {
        const testMessage = 'Patient consultation: Confidential medical information';

        test('should complete full E2EE message flow from Alice to Bob', async () => {
            // Given: Alice and Bob both online with established sessions
            expect(aliceFlow.isInitialized).toBe(true);
            expect(bobFlow.isInitialized).toBe(true);
            
            let receivedMessage = null;
            
            // Mock transport layer for Bob to receive messages
            const originalSendThroughTransport = aliceFlow.sendThroughTransport;
            aliceFlow.sendThroughTransport = async (messageData) => {
                if (messageData.type === 'encrypted_message') {
                    // Simulate message reaching Bob
                    setTimeout(async () => {
                        receivedMessage = await bobFlow.receiveMessage(messageData);
                    }, 10);
                }
                return { success: true };
            };
            
            // When: Alice sends encrypted message
            const sendResult = await aliceFlow.sendMessage(bobId, testMessage);
            
            // Then: Message encrypted client-side, server routes opaque ciphertext, Bob decrypts to exact plaintext
            expect(sendResult.delivered).toBe(true);
            expect(sendResult.messageId).toBeDefined();
            expect(sendResult.timestamp).toBeDefined();
            
            // Wait for Bob to receive
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(receivedMessage).toBeDefined();
            expect(receivedMessage.message).toBe(testMessage);
            expect(receivedMessage.sender).toBe(aliceId);
            expect(receivedMessage.messageId).toBeDefined();
            
            // Verify server never sees PHI (message should be encrypted in transport)
            // This would be verified by monitoring network traffic in production
        }, 10000);

        test('should handle message access control', async () => {
            // Given: User without message permissions
            const restrictedFlow = new MessageFlowManager('restricted_user_001', aliceSignal, aliceKeyManager);
            await restrictedFlow.initialize();
            
            // When: Attempting to send message without permissions
            // Then: Should be blocked by access control
            await expect(restrictedFlow.sendMessage(bobId, testMessage)).rejects.toThrow('Access denied');
            
            await restrictedFlow.cleanup();
        });

        test('should track message delivery confirmations', async () => {
            // Given: Message sending system
            const messageStats = aliceFlow.getMessageStats();
            const initialPending = messageStats.pendingDeliveries;
            
            // When: Message sent with delivery tracking
            const sendResult = await aliceFlow.sendMessage(bobId, testMessage);
            
            // Then: Delivery should be tracked
            expect(sendResult.messageId).toBeDefined();
            
            const updatedStats = aliceFlow.getMessageStats();
            expect(updatedStats.pendingDeliveries).toBeGreaterThanOrEqual(initialPending);
        });

        test('should maintain message ordering and sequence numbers', async () => {
            // Given: Multiple messages to same recipient
            const messages = [
                'Message 1: Patient vitals',
                'Message 2: Lab results',
                'Message 3: Treatment plan'
            ];
            
            const receivedMessages = [];
            
            // Mock transport to collect messages
            aliceFlow.sendThroughTransport = async (messageData) => {
                if (messageData.type === 'encrypted_message') {
                    receivedMessages.push(messageData);
                }
                return { success: true };
            };
            
            // When: Messages sent in sequence
            for (const message of messages) {
                await aliceFlow.sendMessage(bobId, message);
            }
            
            // Then: Messages should maintain sequence numbers
            expect(receivedMessages.length).toBe(messages.length);
            
            for (let i = 0; i < receivedMessages.length; i++) {
                expect(receivedMessages[i].messageNumber).toBe(i);
            }
        });
    });

    // TestCase #8: X3DH Key Exchange Protocol
    describe('TestCase #8: X3DH Key Exchange Protocol', () => {
        test('should establish shared secret through X3DH protocol', async () => {
            // Given: Alice wants to initiate conversation with Bob (no prior session)
            expect(aliceFlow.activeSessions.has(bobId)).toBe(false);
            
            // When: Alice initiates X3DH key exchange
            const session = await aliceFlow.initiateX3DHKeyExchange(bobId);
            
            // Then: Shared secret established, session created
            expect(session).toBeDefined();
            expect(session.sessionId).toBeDefined();
            expect(session.recipientId).toBe(bobId);
            expect(session.rootKey).toBeInstanceOf(Uint8Array);
            expect(session.sendingChain).toBeInstanceOf(Uint8Array);
            expect(session.receivingChain).toBeInstanceOf(Uint8Array);
            expect(session.messageCount).toBe(0);
            
            // Session should be stored
            expect(aliceFlow.activeSessions.has(bobId)).toBe(true);
        });

        test('should respond to X3DH key exchange correctly', async () => {
            // Given: Bob receives X3DH initiation from Alice
            const keyExchangeMessage = {
                type: 'x3dh_initiate',
                sender: aliceId,
                recipient: bobId,
                ephemeralKey: 'base64_encoded_ephemeral_key',
                timestamp: Date.now()
            };
            
            // When: Bob responds to key exchange
            const session = await bobFlow.respondToX3DHKeyExchange(keyExchangeMessage);
            
            // Then: Bob creates corresponding session
            expect(session).toBeDefined();
            expect(session.recipientId).toBe(aliceId);
            expect(session.sessionId).toBeDefined();
            expect(bobFlow.activeSessions.has(aliceId)).toBe(true);
        });

        test('should handle concurrent key exchange attempts', async () => {
            // Given: Multiple simultaneous key exchange attempts
            const promises = [
                aliceFlow.initiateX3DHKeyExchange(bobId),
                aliceFlow.initiateX3DHKeyExchange(bobId)
            ];
            
            // When: Both attempts executed
            const results = await Promise.allSettled(promises);
            
            // Then: One should succeed, one should fail due to already in progress
            const successful = results.filter(r => r.status === 'fulfilled');
            const failed = results.filter(r => r.status === 'rejected');
            
            expect(successful.length).toBe(1);
            expect(failed.length).toBe(1);
            expect(failed[0].reason.message).toContain('already in progress');
        });

        test('should clean up expired key exchange attempts', async () => {
            // Given: Pending key exchange that times out
            aliceFlow.pendingKeyExchanges.set(bobId, {
                startTime: Date.now() - 35000, // 35 seconds ago (expired)
                ephemeralKey: 'test_key'
            });
            
            // When: New key exchange initiated
            const session = await aliceFlow.initiateX3DHKeyExchange(bobId);
            
            // Then: Should succeed despite expired pending exchange
            expect(session).toBeDefined();
            expect(session.recipientId).toBe(bobId);
        });

        test('should derive proper session keys from shared secret', async () => {
            // Given: X3DH key exchange
            const session = await aliceFlow.initiateX3DHKeyExchange(bobId);
            
            // When: Examining derived keys
            // Then: All required keys should be present and different
            expect(session.rootKey).toBeDefined();
            expect(session.sendingChain).toBeDefined();
            expect(session.receivingChain).toBeDefined();
            
            // Keys should be different
            expect(session.rootKey).not.toEqual(session.sendingChain);
            expect(session.sendingChain).not.toEqual(session.receivingChain);
            expect(session.rootKey).not.toEqual(session.receivingChain);
        });
    });

    // TestCase #10: Offline Message Queueing
    describe('TestCase #10: Offline Message Queueing', () => {
        const offlineMessage = 'Urgent: Patient requires immediate attention';

        test('should queue messages when recipient is offline', async () => {
            // Given: Alice sends message to offline Bob
            const messageEnvelope = {
                id: 'test_msg_001',
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: Date.now(),
                payload: await aliceSignal.encryptMessage(bobId, offlineMessage)
            };
            
            // When: Message queued for offline delivery
            await aliceFlow.queueOfflineMessage(bobId, messageEnvelope);
            
            // Then: Message should be in queue
            const stats = aliceFlow.getMessageStats();
            expect(stats.queuedMessages).toBeGreaterThan(0);
            
            const queue = aliceFlow.messageQueue.get(bobId);
            expect(queue).toBeDefined();
            expect(queue.messages.length).toBe(1);
            expect(queue.messages[0].envelope.id).toBe('test_msg_001');
        });

        test('should deliver queued messages when recipient comes online', async () => {
            // Given: Multiple messages queued for offline Bob
            const messages = [
                'Queued message 1',
                'Queued message 2', 
                'Queued message 3'
            ];
            
            for (let i = 0; i < messages.length; i++) {
                const envelope = {
                    id: `queued_msg_${i}`,
                    type: 'encrypted_message',
                    sender: aliceId,
                    recipient: bobId,
                    timestamp: Date.now(),
                    payload: await aliceSignal.encryptMessage(bobId, messages[i])
                };
                
                await aliceFlow.queueOfflineMessage(bobId, envelope);
            }
            
            expect(aliceFlow.messageQueue.get(bobId).messages.length).toBe(3);
            
            // When: Bob comes online and messages are delivered
            const deliveryResult = await aliceFlow.deliverOfflineMessages(bobId);
            
            // Then: All messages should be delivered successfully
            expect(deliveryResult.delivered).toBe(3);
            expect(deliveryResult.failed).toBe(0);
            expect(deliveryResult.remaining).toBe(0);
            
            // Queue should be empty
            expect(aliceFlow.messageQueue.has(bobId)).toBe(false);
        });

        test('should handle delivery failures with retry logic', async () => {
            // Given: Message queued with failing transport
            const envelope = {
                id: 'failing_msg_001',
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: Date.now(),
                payload: await aliceSignal.encryptMessage(bobId, offlineMessage)
            };
            
            await aliceFlow.queueOfflineMessage(bobId, envelope);
            
            // Mock failing transport
            let attemptCount = 0;
            aliceFlow.sendThroughTransport = async (messageData) => {
                attemptCount++;
                if (attemptCount < 3) {
                    return { success: false }; // Fail first 2 attempts
                }
                return { success: true }; // Succeed on 3rd attempt
            };
            
            // When: Attempting delivery multiple times
            await aliceFlow.deliverOfflineMessages(bobId);
            await aliceFlow.deliverOfflineMessages(bobId);
            const finalResult = await aliceFlow.deliverOfflineMessages(bobId);
            
            // Then: Should eventually succeed
            expect(finalResult.delivered).toBe(1);
            expect(attemptCount).toBe(3);
        });

        test('should persist offline queue across restarts', async () => {
            // Given: Messages in offline queue
            const envelope = {
                id: 'persistent_msg_001',
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: Date.now(),
                payload: await aliceSignal.encryptMessage(bobId, offlineMessage)
            };
            
            await aliceFlow.queueOfflineMessage(bobId, envelope);
            expect(aliceFlow.messageQueue.get(bobId).messages.length).toBe(1);
            
            // When: Manager restarted (simulate)
            await aliceFlow.cleanup();
            
            const newAliceFlow = new MessageFlowManager(aliceId, aliceSignal, aliceKeyManager);
            await newAliceFlow.initialize();
            
            // Then: Queue should be restored from persistence
            const restoredQueue = newAliceFlow.messageQueue.get(bobId);
            expect(restoredQueue).toBeDefined();
            expect(restoredQueue.messages.length).toBe(1);
            expect(restoredQueue.messages[0].envelope.id).toBe('persistent_msg_001');
            
            await newAliceFlow.cleanup();
        });

        test('should handle maximum retry attempts', async () => {
            // Given: Message with failing delivery
            const envelope = {
                id: 'max_retry_msg_001',
                type: 'encrypted_message',
                sender: aliceId,
                recipient: bobId,
                timestamp: Date.now(),
                payload: await aliceSignal.encryptMessage(bobId, offlineMessage)
            };
            
            await aliceFlow.queueOfflineMessage(bobId, envelope);
            
            // Mock always failing transport
            aliceFlow.sendThroughTransport = async () => ({ success: false });
            
            // When: Attempting delivery beyond max attempts
            for (let i = 0; i < 6; i++) { // Max attempts is 5
                await aliceFlow.deliverOfflineMessages(bobId);
            }
            
            // Then: Message should be removed from queue after max attempts
            const queue = aliceFlow.messageQueue.get(bobId);
            expect(queue?.messages.length || 0).toBe(0);
        });
    });

    // Integration tests
    describe('Message Flow Integration', () => {
        test('should integrate X3DH with message sending', async () => {
            // Given: No existing session
            expect(aliceFlow.activeSessions.has(bobId)).toBe(false);
            
            // When: Sending message (should trigger X3DH)
            const result = await aliceFlow.sendMessage(bobId, 'Test message requiring new session');
            
            // Then: Session should be established and message sent
            expect(result.delivered).toBe(true);
            expect(aliceFlow.activeSessions.has(bobId)).toBe(true);
            
            const session = aliceFlow.activeSessions.get(bobId);
            expect(session.messageCount).toBe(1);
        });

        test('should handle message flow with HIPAA compliance', async () => {
            // Given: HIPAA middleware active
            expect(aliceFlow.hipaaMiddleware.isInitialized).toBe(true);
            
            const testMessage = 'Patient John Doe has diabetes';
            
            // When: Sending message with PHI
            const result = await aliceFlow.sendMessage(bobId, testMessage);
            
            // Then: Message should be sent but PHI not logged
            expect(result.delivered).toBe(true);
            
            // Verify HIPAA activity was updated
            const sessionInfo = aliceFlow.hipaaMiddleware.getSessionInfo();
            expect(sessionInfo.isActive).toBe(true);
            expect(sessionInfo.lastActivity).toBeGreaterThan(Date.now() - 5000);
        });

        test('should maintain performance with large message volumes', async () => {
            // Given: Large number of messages
            const messageCount = 100;
            const startTime = Date.now();
            
            // When: Sending multiple messages rapidly
            const promises = [];
            for (let i = 0; i < messageCount; i++) {
                promises.push(aliceFlow.sendMessage(bobId, `Message ${i}`));
            }
            
            const results = await Promise.all(promises);
            const endTime = Date.now();
            
            // Then: All messages should be processed efficiently
            expect(results.length).toBe(messageCount);
            expect(results.every(r => r.delivered)).toBe(true);
            
            const avgTimePerMessage = (endTime - startTime) / messageCount;
            expect(avgTimePerMessage).toBeLessThan(100); // Less than 100ms per message
        });
    });
});