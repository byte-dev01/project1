// Implements TestCase #5: WebRTC SDP Encryption
// Implements TestCase #11: WebRTC Call with E2EE Data Channel
// Secure WebRTC implementation with encrypted signaling and data channels

import { generateRandomBytes, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/crypto.js';
import SignalProtocolManager from '../encryption/SignalProtocolManager.js';

/**
 * Secure WebRTC Manager for HIPAA E2EE Video Chat
 * Encrypts SDP signaling and provides E2EE data channels
 */
class SecureWebRTC {
    constructor(userId, signalManager) {
        this.userId = userId;
        this.signalManager = signalManager;
        this.peerConnection = null;
        this.dataChannel = null;
        this.localStream = null;
        this.encryptedSdpKey = null;
        this.isEncryptionEnabled = true;
        
        // WebRTC configuration with DTLS-SRTP
        this.rtcConfig = {
            'iceServers': [
                {url: 'stun:stun.l.google.com:19302'},
                {url: 'stun:stun1.l.google.com:19302'},
                {url: 'stun:stun2.l.google.com:19302'},
                {url: 'stun:stun3.l.google.com:19302'},
                {url: 'stun:stun4.l.google.com:19302'}
            ]
        };
        
        this.pcConstraints = {
            'optional': [
                {'DtlsSrtpKeyAgreement': true}
            ]
        };
    }

    // Implements TestCase #5: WebRTC SDP Encryption
    async createSecureOffer(recipientId) {
        try {
            console.log('Creating secure WebRTC offer with encrypted SDP');
            
            // Create peer connection with DTLS-SRTP
            this.peerConnection = new RTCPeerConnection(this.rtcConfig, this.pcConstraints);
            this.setupPeerConnectionHandlers();
            
            // Add local stream if available
            if (this.localStream) {
                this.peerConnection.addStream(this.localStream);
            }
            
            // Create encrypted data channel before offer
            await this.createEncryptedDataChannel();
            
            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Wait for ICE gathering to complete
            await this.waitForIceGathering();
            
            // Encrypt the complete SDP
            const encryptedSdp = await this.encryptSDP(this.peerConnection.localDescription, recipientId);
            
            console.log('Secure offer created with encrypted SDP');
            return {
                type: 'secure_offer',
                encryptedSdp: encryptedSdp,
                sender: this.userId,
                recipient: recipientId,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Failed to create secure offer:', error);
            throw new Error('Failed to create secure WebRTC offer');
        }
    }

    async createSecureAnswer(encryptedOfferData) {
        try {
            console.log('Creating secure WebRTC answer');
            
            // Decrypt the received SDP offer
            const decryptedOffer = await this.decryptSDP(encryptedOfferData.encryptedSdp, encryptedOfferData.sender);
            
            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.rtcConfig, this.pcConstraints);
            this.setupPeerConnectionHandlers();
            
            // Add local stream
            if (this.localStream) {
                this.peerConnection.addStream(this.localStream);
            }
            
            // Set remote description from decrypted offer
            await this.peerConnection.setRemoteDescription(decryptedOffer);
            
            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Wait for ICE gathering
            await this.waitForIceGathering();
            
            // Encrypt the answer SDP
            const encryptedSdp = await this.encryptSDP(this.peerConnection.localDescription, encryptedOfferData.sender);
            
            console.log('Secure answer created');
            return {
                type: 'secure_answer',
                encryptedSdp: encryptedSdp,
                sender: this.userId,
                recipient: encryptedOfferData.sender,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Failed to create secure answer:', error);
            throw new Error('Failed to create secure WebRTC answer');
        }
    }

    async processSecureAnswer(encryptedAnswerData) {
        try {
            // Decrypt the answer SDP
            const decryptedAnswer = await this.decryptSDP(encryptedAnswerData.encryptedSdp, encryptedAnswerData.sender);
            
            // Set as remote description
            await this.peerConnection.setRemoteDescription(decryptedAnswer);
            
            console.log('Secure answer processed successfully');
            
        } catch (error) {
            console.error('Failed to process secure answer:', error);
            throw new Error('Failed to process secure WebRTC answer');
        }
    }

    // Implements TestCase #11: WebRTC Call with E2EE Data Channel
    async createEncryptedDataChannel() {
        try {
            if (!this.peerConnection) {
                throw new Error('Peer connection not initialized');
            }
            
            // Create data channel with reliable delivery
            this.dataChannel = this.peerConnection.createDataChannel('secureChat', {
                reliable: true,
                ordered: true
            });
            
            // Setup data channel handlers
            this.dataChannel.onopen = () => {
                console.log('Encrypted data channel opened');
                this.onDataChannelOpen && this.onDataChannelOpen();
            };
            
            this.dataChannel.onclose = () => {
                console.log('Encrypted data channel closed');
                this.onDataChannelClose && this.onDataChannelClose();
            };
            
            this.dataChannel.onmessage = async (event) => {
                try {
                    // Decrypt received message
                    const encryptedData = JSON.parse(event.data);
                    const decryptedMessage = await this.decryptDataChannelMessage(encryptedData);
                    
                    console.log('Received encrypted data channel message');
                    this.onEncryptedMessage && this.onEncryptedMessage(decryptedMessage);
                    
                } catch (error) {
                    console.error('Failed to decrypt data channel message:', error);
                }
            };
            
            // Setup incoming data channel handler
            this.peerConnection.ondatachannel = (event) => {
                const channel = event.channel;
                channel.onmessage = this.dataChannel.onmessage;
                channel.onopen = this.dataChannel.onopen;
                channel.onclose = this.dataChannel.onclose;
                this.dataChannel = channel;
            };
            
            console.log('Encrypted data channel created');
            
        } catch (error) {
            console.error('Failed to create encrypted data channel:', error);
            throw error;
        }
    }

    async sendEncryptedMessage(message, recipientId) {
        try {
            if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
                throw new Error('Data channel not ready');
            }
            
            // Encrypt message using Signal Protocol
            const encryptedMessage = await this.signalManager.encryptMessage(recipientId, message);
            
            // Add additional metadata for data channel
            const dataChannelMessage = {
                type: 'encrypted_chat',
                payload: encryptedMessage,
                timestamp: Date.now(),
                sender: this.userId
            };
            
            // Send over data channel
            this.dataChannel.send(JSON.stringify(dataChannelMessage));
            
            console.log('Encrypted message sent over data channel');
            
        } catch (error) {
            console.error('Failed to send encrypted message:', error);
            throw error;
        }
    }

    async decryptDataChannelMessage(encryptedData) {
        try {
            if (encryptedData.type !== 'encrypted_chat') {
                throw new Error('Invalid message type');
            }
            
            // Decrypt using Signal Protocol
            const decryptedMessage = await this.signalManager.decryptMessage(encryptedData.payload);
            
            return {
                message: decryptedMessage,
                sender: encryptedData.sender,
                timestamp: encryptedData.timestamp
            };
            
        } catch (error) {
            console.error('Failed to decrypt data channel message:', error);
            throw error;
        }
    }

    // SDP Encryption/Decryption methods
    async encryptSDP(sdp, recipientId) {
        try {
            // Convert SDP to string for encryption
            const sdpString = JSON.stringify({
                type: sdp.type,
                sdp: sdp.sdp
            });
            
            // Encrypt using Signal Protocol
            const encryptedSdp = await this.signalManager.encryptMessage(recipientId, sdpString);
            
            return {
                encryptedSdp: encryptedSdp,
                sdpType: sdp.type,
                encryptionVersion: '1.0'
            };
            
        } catch (error) {
            console.error('SDP encryption failed:', error);
            throw new Error('Failed to encrypt SDP');
        }
    }

    async decryptSDP(encryptedSdpData, senderId) {
        try {
            // Decrypt SDP using Signal Protocol
            const decryptedSdpString = await this.signalManager.decryptMessage(encryptedSdpData.encryptedSdp);
            const sdpData = JSON.parse(decryptedSdpString);
            
            // Create RTCSessionDescription
            return new RTCSessionDescription({
                type: sdpData.type,
                sdp: sdpData.sdp
            });
            
        } catch (error) {
            console.error('SDP decryption failed:', error);
            throw new Error('Failed to decrypt SDP');
        }
    }

    // Helper methods
    setupPeerConnectionHandlers() {
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate generated');
                // In production, encrypt and send ICE candidates
                this.onIceCandidate && this.onIceCandidate(event.candidate);
            } else {
                console.log('ICE gathering completed');
                this.onIceGatheringComplete && this.onIceGatheringComplete();
            }
        };
        
        this.peerConnection.onaddstream = (event) => {
            console.log('Remote stream received');
            this.onRemoteStream && this.onRemoteStream(event.stream);
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            this.onConnectionStateChange && this.onConnectionStateChange(this.peerConnection.connectionState);
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            this.onIceConnectionStateChange && this.onIceConnectionStateChange(this.peerConnection.iceConnectionState);
        };
    }

    async waitForIceGathering() {
        return new Promise((resolve) => {
            if (this.peerConnection.iceGatheringState === 'complete') {
                resolve();
                return;
            }
            
            const checkState = () => {
                if (this.peerConnection.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    setTimeout(checkState, 100);
                }
            };
            
            checkState();
        });
    }

    // Media stream methods
    async getUserMedia(constraints = { audio: true, video: true }) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Local media stream acquired');
            return this.localStream;
        } catch (error) {
            console.error('Failed to get user media:', error);
            throw error;
        }
    }

    getLocalStream() {
        return this.localStream;
    }

    // Connection management
    async hangup() {
        try {
            // Close data channel
            if (this.dataChannel) {
                this.dataChannel.close();
                this.dataChannel = null;
            }
            
            // Close peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            
            console.log('Secure WebRTC connection closed');
            
        } catch (error) {
            console.error('Error during hangup:', error);
        }
    }

    // Status methods
    isConnected() {
        return this.peerConnection && 
               this.peerConnection.connectionState === 'connected';
    }

    isDataChannelReady() {
        return this.dataChannel && 
               this.dataChannel.readyState === 'open';
    }

    getConnectionInfo() {
        return {
            userId: this.userId,
            connectionState: this.peerConnection?.connectionState || 'disconnected',
            iceConnectionState: this.peerConnection?.iceConnectionState || 'disconnected',
            dataChannelState: this.dataChannel?.readyState || 'closed',
            encryptionEnabled: this.isEncryptionEnabled,
            hasLocalStream: !!this.localStream
        };
    }

    // Event handler setters
    setOnRemoteStream(handler) { this.onRemoteStream = handler; }
    setOnDataChannelOpen(handler) { this.onDataChannelOpen = handler; }
    setOnDataChannelClose(handler) { this.onDataChannelClose = handler; }
    setOnEncryptedMessage(handler) { this.onEncryptedMessage = handler; }
    setOnIceCandidate(handler) { this.onIceCandidate = handler; }
    setOnConnectionStateChange(handler) { this.onConnectionStateChange = handler; }
}

export default SecureWebRTC;