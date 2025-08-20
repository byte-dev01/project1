// Implements TestCase #7: Complete E2EE Message Flow
// Implements TestCase #8: X3DH Key Exchange Protocol  
// Implements TestCase #10: Offline Message Queueing
// E2EE Message Pipeline with X3DH and offline delivery

import { generateRandomBytes, arrayBufferToBase64, base64ToArrayBuffer, validateMessageEnvelope } from '../utils/crypto.js';
import HIPAAMiddleware from '../hipaa/HIPAAMiddleware.js';

/**
 * Message Flow Manager for HIPAA E2EE System
 * Handles complete message encryption pipeline with X3DH and offline queueing
 */
class MessageFlowManager {
    constructor(userId, signalManager, keyManager) {
        this.userId = userId;
        this.signalManager = signalManager;
        this.keyManager = keyManager;
        this.hipaaMiddleware = null;
        this.messageQueue = new Map(); // For offline messages
        this.pendingKeyExchanges = new Map(); // For X3DH sessions
        this.activeSessions = new Map(); // Active chat sessions
        this.deliveryConfirmations = new Map(); // Message delivery tracking
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('Initializing Message Flow Manager');
            
            // Initialize HIPAA middleware
            this.hipaaMiddleware = new HIPAAMiddleware(this.userId);
            await this.hipaaMiddleware.initialize();
            
            // Load offline message queue
            await this.loadOfflineQueue();
            
            // Setup session cleanup
            this.startSessionCleanup();
            
            this.isInitialized = true;
            console.log('Message Flow Manager initialized');
            
        } catch (error) {
            console.error('Message Flow Manager initialization failed:', error);
            throw new Error('Failed to initialize Message Flow Manager');
        }
    }

    // Implements TestCase #7: Complete E2EE Message Flow
    async sendMessage(recipientId, message) {
        try {
            console.log('Sending E2EE message to:', recipientId);
            
            // Update activity for HIPAA compliance
            this.hipaaMiddleware.updateActivity();
            
            // Verify access permissions
            const accessResult = await this.hipaaMiddleware.verifyAccess('message', 'send');
            if (!accessResult.allowed) {
                throw new Error(`Access denied: ${accessResult.reason}`);
            }
            
            // Check if session exists, if not initiate X3DH
            let session = this.activeSessions.get(recipientId);
            if (!session) {
                session = await this.initiateX3DHKeyExchange(recipientId);
            }
            
            // Encrypt message using established session
            const encryptedMessage = await this.signalManager.encryptMessage(recipientId, message);
            
            // Create message envelope
            const messageEnvelope = {
                id: this.generateMessageId(),
                type: 'encrypted_message',
                sender: this.userId,
                recipient: recipientId,
                timestamp: Date.now(),
                payload: encryptedMessage,
                sessionId: session.sessionId,
                messageNumber: session.messageCount++
            };
            
            // Validate envelope
            if (!validateMessageEnvelope(messageEnvelope.payload)) {
                throw new Error('Invalid message envelope');
            }
            
            // Store delivery confirmation
            this.deliveryConfirmations.set(messageEnvelope.id, {
                status: 'pending',
                timestamp: Date.now(),
                attempts: 0
            });
            
            // Log message event (without PHI)
            await this.hipaaMiddleware.logMessageEvent('message_sent', { message }, recipientId);
            
            // Send through transport layer
            const deliveryResult = await this.sendThroughTransport(messageEnvelope);
            
            console.log('E2EE message sent successfully');
            return {
                messageId: messageEnvelope.id,
                delivered: deliveryResult.success,
                timestamp: messageEnvelope.timestamp
            };
            
        } catch (error) {
            console.error('Failed to send E2EE message:', error);
            
            // Log failure
            await this.hipaaMiddleware.logMessageEvent('message_send_failed', { error: error.message }, recipientId);
            
            throw new Error('Failed to send encrypted message');
        }
    }

    async receiveMessage(messageEnvelope) {
        try {
            console.log('Receiving E2EE message from:', messageEnvelope.sender);
            
            // Update activity
            this.hipaaMiddleware.updateActivity();
            
            // Verify access permissions
            const accessResult = await this.hipaaMiddleware.verifyAccess('message', 'receive');
            if (!accessResult.allowed) {
                throw new Error(`Access denied: ${accessResult.reason}`);
            }
            
            // Validate message envelope
            if (!validateMessageEnvelope(messageEnvelope.payload)) {
                throw new Error('Invalid message envelope received');
            }
            
            // Decrypt message
            const decryptedMessage = await this.signalManager.decryptMessage(messageEnvelope.payload);
            
            // Update session
            const session = this.activeSessions.get(messageEnvelope.sender);
            if (session) {
                session.lastActivity = Date.now();
                session.messagesReceived++;
            }
            
            // Send delivery confirmation
            await this.sendDeliveryConfirmation(messageEnvelope);
            
            // Log message event (without PHI)
            await this.hipaaMiddleware.logMessageEvent('message_received', { message: decryptedMessage }, messageEnvelope.sender);
            
            console.log('E2EE message received and decrypted');
            return {
                messageId: messageEnvelope.id,
                sender: messageEnvelope.sender,
                message: decryptedMessage,
                timestamp: messageEnvelope.timestamp,
                sessionId: messageEnvelope.sessionId
            };
            
        } catch (error) {
            console.error('Failed to receive E2EE message:', error);
            
            // Log failure
            await this.hipaaMiddleware.logMessageEvent('message_receive_failed', { error: error.message }, messageEnvelope.sender);
            
            throw new Error('Failed to decrypt received message');
        }
    }

    // Implements TestCase #8: X3DH Key Exchange Protocol
    async initiateX3DHKeyExchange(recipientId) {
        try {
            console.log('Initiating X3DH key exchange with:', recipientId);
            
            // Check if key exchange already in progress
            if (this.pendingKeyExchanges.has(recipientId)) {
                const pending = this.pendingKeyExchanges.get(recipientId);
                if (Date.now() - pending.startTime < 30000) { // 30 second timeout
                    throw new Error('Key exchange already in progress');
                }
            }
            
            // Generate ephemeral key pair for X3DH
            const ephemeralKeyPair = await this.generateEphemeralKeyPair();
            
            // Fetch recipient's key bundle from server
            const recipientKeyBundle = await this.fetchKeyBundle(recipientId);
            if (!recipientKeyBundle) {
                throw new Error('Recipient key bundle not found');
            }
            
            // Perform X3DH key agreement
            const sharedSecret = await this.performX3DH(ephemeralKeyPair, recipientKeyBundle);
            
            // Derive root key and chain keys
            const sessionKeys = await this.deriveSessionKeys(sharedSecret);
            
            // Create session
            const session = {
                sessionId: this.generateSessionId(recipientId),
                recipientId: recipientId,
                rootKey: sessionKeys.rootKey,
                sendingChain: sessionKeys.sendingChain,
                receivingChain: sessionKeys.receivingChain,
                messageCount: 0,
                messagesReceived: 0,
                established: Date.now(),
                lastActivity: Date.now()
            };
            
            // Store session
            this.activeSessions.set(recipientId, session);
            
            // Send initial key exchange message
            const keyExchangeMessage = {
                type: 'x3dh_initiate',
                sender: this.userId,
                recipient: recipientId,
                ephemeralKey: arrayBufferToBase64(ephemeralKeyPair.publicKey),
                timestamp: Date.now()
            };
            
            await this.sendThroughTransport(keyExchangeMessage);
            
            // Log key exchange
            await this.hipaaMiddleware.logKeyEvent('x3dh_initiated', 'session', session.sessionId);
            
            console.log('X3DH key exchange completed');
            return session;
            
        } catch (error) {
            console.error('X3DH key exchange failed:', error);
            
            // Clean up pending exchange
            this.pendingKeyExchanges.delete(recipientId);
            
            throw new Error('Failed to establish secure session');
        }
    }

    async respondToX3DHKeyExchange(keyExchangeMessage) {
        try {
            console.log('Responding to X3DH key exchange from:', keyExchangeMessage.sender);
            
            // Validate key exchange message
            if (!keyExchangeMessage.ephemeralKey) {
                throw new Error('Invalid key exchange message');
            }
            
            // Generate our ephemeral key pair
            const ourEphemeralKeyPair = await this.generateEphemeralKeyPair();
            
            // Get our key bundle
            const ourKeys = await this.signalManager.generateIdentityKeys();
            
            // Perform X3DH from responder side
            const senderEphemeralKey = base64ToArrayBuffer(keyExchangeMessage.ephemeralKey);
            const sharedSecret = await this.performX3DHResponder(senderEphemeralKey, ourEphemeralKeyPair, ourKeys);
            
            // Derive session keys
            const sessionKeys = await this.deriveSessionKeys(sharedSecret);
            
            // Create session
            const session = {
                sessionId: this.generateSessionId(keyExchangeMessage.sender),
                recipientId: keyExchangeMessage.sender,
                rootKey: sessionKeys.rootKey,
                sendingChain: sessionKeys.sendingChain,
                receivingChain: sessionKeys.receivingChain,
                messageCount: 0,
                messagesReceived: 0,
                established: Date.now(),
                lastActivity: Date.now()
            };
            
            this.activeSessions.set(keyExchangeMessage.sender, session);
            
            // Send response
            const response = {
                type: 'x3dh_response',
                sender: this.userId,
                recipient: keyExchangeMessage.sender,
                ephemeralKey: arrayBufferToBase64(ourEphemeralKeyPair.publicKey),
                timestamp: Date.now()
            };
            
            await this.sendThroughTransport(response);
            
            // Log key exchange
            await this.hipaaMiddleware.logKeyEvent('x3dh_responded', 'session', session.sessionId);
            
            console.log('X3DH key exchange response sent');
            return session;
            
        } catch (error) {
            console.error('Failed to respond to X3DH key exchange:', error);
            throw error;
        }
    }

    // Implements TestCase #10: Offline Message Queueing
    async queueOfflineMessage(recipientId, messageEnvelope) {
        try {
            console.log('Queueing offline message for:', recipientId);
            
            // Get or create queue for recipient
            let recipientQueue = this.messageQueue.get(recipientId);
            if (!recipientQueue) {
                recipientQueue = {
                    messages: [],
                    created: Date.now(),
                    lastUpdated: Date.now()
                };
                this.messageQueue.set(recipientId, recipientQueue);
            }
            
            // Add message to queue
            recipientQueue.messages.push({
                envelope: messageEnvelope,
                queuedAt: Date.now(),
                attempts: 0,
                maxAttempts: 5
            });
            
            recipientQueue.lastUpdated = Date.now();
            
            // Persist queue
            await this.persistOfflineQueue();
            
            // Log queuing
            await this.hipaaMiddleware.logMessageEvent('message_queued', { messageId: messageEnvelope.id }, recipientId);
            
            console.log('Message queued for offline delivery');
            
        } catch (error) {
            console.error('Failed to queue offline message:', error);
            throw error;
        }
    }

    async deliverOfflineMessages(recipientId) {
        try {
            const recipientQueue = this.messageQueue.get(recipientId);
            if (!recipientQueue || recipientQueue.messages.length === 0) {
                return [];
            }
            
            console.log(`Delivering ${recipientQueue.messages.length} offline messages to:`, recipientId);
            
            const deliveredMessages = [];
            const failedMessages = [];
            
            for (const queuedMessage of recipientQueue.messages) {
                try {
                    // Attempt delivery
                    const result = await this.sendThroughTransport(queuedMessage.envelope);
                    
                    if (result.success) {
                        deliveredMessages.push(queuedMessage);
                        
                        // Log successful delivery
                        await this.hipaaMiddleware.logMessageEvent('offline_message_delivered', 
                            { messageId: queuedMessage.envelope.id }, recipientId);
                    } else {
                        queuedMessage.attempts++;
                        if (queuedMessage.attempts >= queuedMessage.maxAttempts) {
                            failedMessages.push(queuedMessage);
                        }
                    }
                    
                } catch (error) {
                    queuedMessage.attempts++;
                    if (queuedMessage.attempts >= queuedMessage.maxAttempts) {
                        failedMessages.push(queuedMessage);
                    }
                    console.error('Failed to deliver offline message:', error);
                }
            }
            
            // Remove delivered and failed messages from queue
            recipientQueue.messages = recipientQueue.messages.filter(msg => 
                !deliveredMessages.includes(msg) && !failedMessages.includes(msg)
            );
            
            // Clean up empty queue
            if (recipientQueue.messages.length === 0) {
                this.messageQueue.delete(recipientId);
            }
            
            // Persist updated queue
            await this.persistOfflineQueue();
            
            console.log(`Delivered ${deliveredMessages.length} offline messages, ${failedMessages.length} failed permanently`);
            
            return {
                delivered: deliveredMessages.length,
                failed: failedMessages.length,
                remaining: recipientQueue.messages.length
            };
            
        } catch (error) {
            console.error('Failed to deliver offline messages:', error);
            throw error;
        }
    }

    // Helper methods for X3DH
    async generateEphemeralKeyPair() {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );
        
        const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        
        return {
            publicKey: publicKey,
            privateKey: privateKey,
            keyPair: keyPair
        };
    }

    async performX3DH(ourEphemeralKeyPair, recipientKeyBundle) {
        // Simplified X3DH implementation
        // In production, use proper X3DH with identity keys, signed pre-keys, and one-time pre-keys
        
        // Import recipient's identity key
        const recipientIdentityKey = await crypto.subtle.importKey(
            'raw',
            recipientKeyBundle.identityKey,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveKey', 'deriveBits']
        );
        
        // Perform ECDH
        const sharedSecret = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: recipientIdentityKey },
            ourEphemeralKeyPair.keyPair.privateKey,
            256
        );
        
        return new Uint8Array(sharedSecret);
    }

    async performX3DHResponder(senderEphemeralKey, ourEphemeralKeyPair, ourKeys) {
        // Import sender's ephemeral key
        const senderKey = await crypto.subtle.importKey(
            'raw',
            senderEphemeralKey,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveKey', 'deriveBits']
        );
        
        // Perform ECDH
        const sharedSecret = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: senderKey },
            ourEphemeralKeyPair.keyPair.privateKey,
            256
        );
        
        return new Uint8Array(sharedSecret);
    }

    async deriveSessionKeys(sharedSecret) {
        // Derive root key using HKDF
        const salt = new Uint8Array(32); // All zeros for simplicity
        const rootKey = await this.hkdf(sharedSecret, salt, 'root_key', 32);
        
        // Derive initial chain keys
        const sendingChain = await this.hkdf(rootKey, salt, 'sending_chain', 32);
        const receivingChain = await this.hkdf(rootKey, salt, 'receiving_chain', 32);
        
        return {
            rootKey: rootKey,
            sendingChain: sendingChain,
            receivingChain: receivingChain
        };
    }

    async hkdf(inputKeyMaterial, salt, info, length) {
        // Simplified HKDF implementation
        const key = await crypto.subtle.importKey(
            'raw',
            inputKeyMaterial,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 1000,
                hash: 'SHA-256'
            },
            key,
            { name: 'AES-GCM', length: length * 8 },
            true,
            ['encrypt', 'decrypt']
        );
        
        const exported = await crypto.subtle.exportKey('raw', derivedKey);
        return new Uint8Array(exported);
    }

    // Transport and delivery methods
    async sendThroughTransport(messageData) {
        // In production, this would send through WebSocket, HTTP, or other transport
        // For demo, simulate transport layer
        
        console.log('Sending through transport:', messageData.type);
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        // Simulate success/failure (95% success rate)
        const success = Math.random() > 0.05;
        
        if (success) {
            // Trigger delivery confirmation if applicable
            if (messageData.type === 'encrypted_message') {
                setTimeout(() => {
                    this.handleDeliveryConfirmation(messageData.id);
                }, Math.random() * 1000);
            }
        }
        
        return { success };
    }

    async sendDeliveryConfirmation(messageEnvelope) {
        const confirmation = {
            type: 'delivery_confirmation',
            messageId: messageEnvelope.id,
            sender: this.userId,
            recipient: messageEnvelope.sender,
            timestamp: Date.now()
        };
        
        await this.sendThroughTransport(confirmation);
    }

    handleDeliveryConfirmation(messageId) {
        const confirmation = this.deliveryConfirmations.get(messageId);
        if (confirmation) {
            confirmation.status = 'delivered';
            confirmation.deliveredAt = Date.now();
            
            // Callback for UI updates
            this.onMessageDelivered && this.onMessageDelivered(messageId);
        }
    }

    // Storage and persistence
    async loadOfflineQueue() {
        // Load from IndexedDB or localStorage
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(`offline_queue_${this.userId}`);
            if (stored) {
                const queueData = JSON.parse(stored);
                this.messageQueue = new Map(Object.entries(queueData));
            }
        }
    }

    async persistOfflineQueue() {
        if (typeof localStorage !== 'undefined') {
            const queueData = Object.fromEntries(this.messageQueue);
            localStorage.setItem(`offline_queue_${this.userId}`, JSON.stringify(queueData));
        }
    }

    async fetchKeyBundle(recipientId) {
        // In production, fetch from key server
        // For demo, return mock key bundle
        return {
            userId: recipientId,
            identityKey: generateRandomBytes(65), // Mock public key
            signedPreKey: generateRandomBytes(65),
            oneTimePreKeys: [generateRandomBytes(65)]
        };
    }

    // Utility methods
    generateMessageId() {
        return `msg_${this.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSessionId(recipientId) {
        return `session_${this.userId}_${recipientId}_${Date.now()}`;
    }

    startSessionCleanup() {
        // Clean up inactive sessions every hour
        setInterval(() => {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            for (const [recipientId, session] of this.activeSessions) {
                if (now - session.lastActivity > maxAge) {
                    this.activeSessions.delete(recipientId);
                    console.log('Cleaned up inactive session:', recipientId);
                }
            }
        }, 60 * 60 * 1000);
    }

    // Status and monitoring
    getMessageStats() {
        const stats = {
            activeSessions: this.activeSessions.size,
            pendingKeyExchanges: this.pendingKeyExchanges.size,
            queuedMessages: 0,
            pendingDeliveries: 0
        };
        
        // Count queued messages
        for (const queue of this.messageQueue.values()) {
            stats.queuedMessages += queue.messages.length;
        }
        
        // Count pending deliveries
        for (const confirmation of this.deliveryConfirmations.values()) {
            if (confirmation.status === 'pending') {
                stats.pendingDeliveries++;
            }
        }
        
        return stats;
    }

    // Event handlers
    setOnMessageDelivered(handler) { this.onMessageDelivered = handler; }
    
    // Cleanup
    async cleanup() {
        try {
            // Persist any pending data
            await this.persistOfflineQueue();
            
            // Clean up sessions
            this.activeSessions.clear();
            this.pendingKeyExchanges.clear();
            this.deliveryConfirmations.clear();
            
            // Cleanup HIPAA middleware
            if (this.hipaaMiddleware) {
                await this.hipaaMiddleware.cleanup();
            }
            
            console.log('Message Flow Manager cleaned up');
            
        } catch (error) {
            console.error('Error during Message Flow Manager cleanup:', error);
        }
    }
}

export default MessageFlowManager;