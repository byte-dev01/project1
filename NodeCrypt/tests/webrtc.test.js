// Test suite for Secure WebRTC (TestCase #5, #11)
// HIPAA E2EE Chat System - WebRTC SDP Encryption and E2EE Data Channel Tests

import SecureWebRTC from '../client/js/webrtc/SecureWebRTC.js';
import SignalProtocolManager from '../client/js/encryption/SignalProtocolManager.js';

// Mock WebRTC APIs for testing
global.RTCPeerConnection = class MockRTCPeerConnection {
    constructor(config, constraints) {
        this.config = config;
        this.constraints = constraints;
        this.localDescription = null;
        this.remoteDescription = null;
        this.connectionState = 'new';
        this.iceConnectionState = 'new';
        this.iceGatheringState = 'new';
        this.onicecandidate = null;
        this.onaddstream = null;
        this.ondatachannel = null;
        this._streams = [];
        this._dataChannels = [];
    }

    async createOffer() {
        return {
            type: 'offer',
            sdp: 'v=0\r\no=- 123456 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n...'
        };
    }

    async createAnswer() {
        return {
            type: 'answer', 
            sdp: 'v=0\r\no=- 654321 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n...'
        };
    }

    async setLocalDescription(desc) {
        this.localDescription = desc;
        setTimeout(() => {
            this.iceGatheringState = 'complete';
        }, 100);
    }

    async setRemoteDescription(desc) {
        this.remoteDescription = desc;
    }

    addStream(stream) {
        this._streams.push(stream);
    }

    createDataChannel(label, options) {
        const channel = new MockDataChannel(label, options);
        this._dataChannels.push(channel);
        return channel;
    }

    close() {
        this.connectionState = 'closed';
        this.iceConnectionState = 'closed';
        this._dataChannels.forEach(channel => channel.close());
    }
};

class MockDataChannel {
    constructor(label, options) {
        this.label = label;
        this.options = options;
        this.readyState = 'connecting';
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        
        // Simulate opening
        setTimeout(() => {
            this.readyState = 'open';
            this.onopen && this.onopen();
        }, 50);
    }

    send(data) {
        if (this.readyState !== 'open') {
            throw new Error('Data channel not open');
        }
        // Echo back the message for testing
        setTimeout(() => {
            this.onmessage && this.onmessage({ data });
        }, 10);
    }

    close() {
        this.readyState = 'closed';
        this.onclose && this.onclose();
    }
}

global.RTCSessionDescription = class {
    constructor(init) {
        this.type = init.type;
        this.sdp = init.sdp;
    }
};

global.navigator = {
    mediaDevices: {
        getUserMedia: async (constraints) => {
            return {
                getTracks: () => [
                    { stop: () => {} },
                    { stop: () => {} }
                ]
            };
        }
    }
};

describe('Secure WebRTC Tests', () => {
    let aliceWebRTC, bobWebRTC;
    let aliceSignal, bobSignal;
    const aliceId = 'doctor_alice_001';
    const bobId = 'patient_bob_001';

    beforeEach(async () => {
        // Initialize Signal Protocol managers
        aliceSignal = new SignalProtocolManager(aliceId);
        bobSignal = new SignalProtocolManager(bobId);
        await aliceSignal.initialize();
        await bobSignal.initialize();

        // Initialize Secure WebRTC managers
        aliceWebRTC = new SecureWebRTC(aliceId, aliceSignal);
        bobWebRTC = new SecureWebRTC(bobId, bobSignal);
    });

    afterEach(async () => {
        // Cleanup
        await aliceWebRTC.hangup();
        await bobWebRTC.hangup();
        
        if (aliceSignal?.store) {
            await aliceSignal.store.secureDelete();
        }
        if (bobSignal?.store) {
            await bobSignal.store.secureDelete();
        }
    });

    // TestCase #5: WebRTC SDP Encryption
    describe('TestCase #5: WebRTC SDP Encryption', () => {
        test('should encrypt offer SDP with session key', async () => {
            // Given: WebRTC peer connection creating offer SDP
            await aliceWebRTC.getUserMedia();
            
            // When: Offer SDP is processed through encryption layer
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            
            // Then: SDP payload encrypted, ICE candidates encrypted, media parameters protected
            expect(secureOffer.type).toBe('secure_offer');
            expect(secureOffer.sender).toBe(aliceId);
            expect(secureOffer.recipient).toBe(bobId);
            expect(secureOffer.encryptedSdp).toBeDefined();
            expect(secureOffer.encryptedSdp.encryptedSdp).toBeDefined();
            expect(secureOffer.encryptedSdp.sdpType).toBe('offer');
            
            // Verify SDP is encrypted (not readable)
            expect(secureOffer.encryptedSdp.encryptedSdp.ciphertext).toBeDefined();
            expect(secureOffer.encryptedSdp.encryptedSdp.iv).toBeDefined();
            expect(secureOffer.encryptedSdp.encryptedSdp.tag).toBeDefined();
            
            // Should not contain plaintext SDP
            const serialized = JSON.stringify(secureOffer);
            expect(serialized).not.toContain('v=0');
            expect(serialized).not.toContain('127.0.0.1');
        });

        test('should decrypt and process answer SDP correctly', async () => {
            // Given: Encrypted offer created
            await aliceWebRTC.getUserMedia();
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            
            // When: Bob creates encrypted answer
            await bobWebRTC.getUserMedia();
            const secureAnswer = await bobWebRTC.createSecureAnswer(secureOffer);
            
            // Then: Answer should be properly encrypted
            expect(secureAnswer.type).toBe('secure_answer');
            expect(secureAnswer.sender).toBe(bobId);
            expect(secureAnswer.recipient).toBe(aliceId);
            expect(secureAnswer.encryptedSdp.sdpType).toBe('answer');
            
            // Alice should be able to process the answer
            await expect(aliceWebRTC.processSecureAnswer(secureAnswer)).resolves.not.toThrow();
        });

        test('should handle SDP encryption failure gracefully', async () => {
            // Given: Invalid recipient ID
            await aliceWebRTC.getUserMedia();
            
            // When: Attempting to create offer with invalid recipient
            // Then: Should throw appropriate error
            await expect(aliceWebRTC.createSecureOffer('')).rejects.toThrow();
        });

        test('should prevent SDP tampering detection', async () => {
            // Given: Valid encrypted offer
            await aliceWebRTC.getUserMedia();
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            
            // When: SDP is tampered with
            secureOffer.encryptedSdp.encryptedSdp.ciphertext = 'tampered_data';
            
            // Then: Decryption should fail
            await bobWebRTC.getUserMedia();
            await expect(bobWebRTC.createSecureAnswer(secureOffer)).rejects.toThrow();
        });

        test('should include proper DTLS-SRTP configuration', async () => {
            // Given: WebRTC configuration
            const connectionInfo = aliceWebRTC.getConnectionInfo();
            
            // When: Checking configuration
            // Then: Should have DTLS-SRTP enabled
            expect(aliceWebRTC.pcConstraints.optional).toContainEqual({'DtlsSrtpKeyAgreement': true});
            expect(aliceWebRTC.rtcConfig.iceServers).toBeDefined();
            expect(aliceWebRTC.rtcConfig.iceServers.length).toBeGreaterThan(0);
        });
    });

    // TestCase #11: WebRTC Call with E2EE Data Channel
    describe('TestCase #11: WebRTC Call with E2EE Data Channel', () => {
        const testMessage = 'Patient consultation notes: Confidential PHI data';

        beforeEach(async () => {
            await aliceWebRTC.getUserMedia();
            await bobWebRTC.getUserMedia();
        });

        test('should create E2EE data channel during call setup', async () => {
            // Given: Established WebRTC connection
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            const secureAnswer = await bobWebRTC.createSecureAnswer(secureOffer);
            await aliceWebRTC.processSecureAnswer(secureAnswer);
            
            // When: Data channel created
            // Then: Data channel should be encrypted and functional
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for channel to open
            
            expect(aliceWebRTC.isDataChannelReady()).toBe(true);
            
            const connectionInfo = aliceWebRTC.getConnectionInfo();
            expect(connectionInfo.dataChannelState).toBe('open');
            expect(connectionInfo.encryptionEnabled).toBe(true);
        });

        test('should encrypt and decrypt data channel messages', async () => {
            // Given: Established connection with data channel
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            const secureAnswer = await bobWebRTC.createSecureAnswer(secureOffer);
            await aliceWebRTC.processSecureAnswer(secureAnswer);
            
            // Wait for data channel to open
            await new Promise(resolve => setTimeout(resolve, 100));
            
            let receivedMessage = null;
            bobWebRTC.setOnEncryptedMessage((decryptedData) => {
                receivedMessage = decryptedData;
            });
            
            // When: Alice sends encrypted message
            await aliceWebRTC.sendEncryptedMessage(testMessage, bobId);
            
            // Then: Bob receives decrypted message
            await new Promise(resolve => setTimeout(resolve, 50)); // Wait for message processing
            
            expect(receivedMessage).toBeDefined();
            expect(receivedMessage.message).toBe(testMessage);
            expect(receivedMessage.sender).toBe(aliceId);
            expect(receivedMessage.timestamp).toBeDefined();
        });

        test('should handle data channel encryption failure', async () => {
            // Given: Data channel not ready
            // When: Attempting to send message without connection
            // Then: Should throw appropriate error
            await expect(aliceWebRTC.sendEncryptedMessage(testMessage, bobId)).rejects.toThrow();
        });

        test('should maintain WebRTC media with DTLS-SRTP', async () => {
            // Given: WebRTC call established
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            const secureAnswer = await bobWebRTC.createSecureAnswer(secureOffer);
            await aliceWebRTC.processSecureAnswer(secureAnswer);
            
            // When: Checking media encryption
            // Then: DTLS-SRTP should be enabled for media streams
            const aliceInfo = aliceWebRTC.getConnectionInfo();
            const bobInfo = bobWebRTC.getConnectionInfo();
            
            expect(aliceInfo.hasLocalStream).toBe(true);
            expect(bobInfo.hasLocalStream).toBe(true);
            expect(aliceInfo.encryptionEnabled).toBe(true);
            expect(bobInfo.encryptionEnabled).toBe(true);
        });

        test('should handle multiple concurrent data channel messages', async () => {
            // Given: Established connection
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            const secureAnswer = await bobWebRTC.createSecureAnswer(secureOffer);
            await aliceWebRTC.processSecureAnswer(secureAnswer);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const receivedMessages = [];
            bobWebRTC.setOnEncryptedMessage((data) => {
                receivedMessages.push(data);
            });
            
            // When: Multiple messages sent rapidly
            const messages = [
                'Message 1: Patient vitals',
                'Message 2: Lab results', 
                'Message 3: Treatment plan'
            ];
            
            for (const msg of messages) {
                await aliceWebRTC.sendEncryptedMessage(msg, bobId);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            
            // Then: All messages should be received and decrypted
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(receivedMessages.length).toBe(messages.length);
            
            messages.forEach((expectedMsg, index) => {
                expect(receivedMessages[index].message).toBe(expectedMsg);
            });
        });

        test('should properly cleanup on hangup', async () => {
            // Given: Active connection with data channel
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(aliceWebRTC.getConnectionInfo().connectionState).not.toBe('closed');
            
            // When: Hangup is called
            await aliceWebRTC.hangup();
            
            // Then: All resources should be cleaned up
            expect(aliceWebRTC.isConnected()).toBe(false);
            expect(aliceWebRTC.isDataChannelReady()).toBe(false);
            expect(aliceWebRTC.getLocalStream()).toBeNull();
        });
    });

    // Integration tests
    describe('Secure WebRTC Integration', () => {
        test('should integrate with Signal Protocol for encryption', async () => {
            // Given: Both WebRTC and Signal Protocol initialized
            expect(aliceWebRTC.signalManager).toBe(aliceSignal);
            expect(aliceSignal.isInitialized()).toBe(true);
            
            // When: Creating secure offer
            await aliceWebRTC.getUserMedia();
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            
            // Then: Should use Signal Protocol for SDP encryption
            expect(secureOffer.encryptedSdp.encryptedSdp.type).toBe('message');
            expect(secureOffer.encryptedSdp.encryptedSdp.sender).toBe(aliceId);
            expect(secureOffer.encryptedSdp.encryptedSdp.recipient).toBe(bobId);
        });

        test('should handle connection state changes properly', async () => {
            // Given: Connection state monitoring
            const stateChanges = [];
            aliceWebRTC.setOnConnectionStateChange((state) => {
                stateChanges.push(state);
            });
            
            // When: Establishing connection
            await aliceWebRTC.getUserMedia();
            const secureOffer = await aliceWebRTC.createSecureOffer(bobId);
            
            // Then: State changes should be tracked
            const info = aliceWebRTC.getConnectionInfo();
            expect(info.connectionState).toBeDefined();
            expect(info.iceConnectionState).toBeDefined();
        });
    });
});