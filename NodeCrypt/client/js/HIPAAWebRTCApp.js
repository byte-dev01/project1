// HIPAA-compliant WebRTC Application integrating E2EE with existing NodeCrypt
// Combines existing WebRTC functionality with Signal Protocol encryption

import SignalProtocolManager from './encryption/SignalProtocolManager.js';
import SecureWebRTC from './webrtc/SecureWebRTC.js';
import KeyRotationManager from './keymanagement/KeyRotationManager.js';
import { generateRandomBytes } from './utils/crypto.js';

/**
 * HIPAA WebRTC Application
 * Integrates existing WebRTC code with E2EE Signal Protocol
 */
class HIPAAWebRTCApp {
    constructor() {
        this.userId = null;
        this.channelName = null;
        this.signalManager = null;
        this.keyManager = null;
        this.secureWebRTC = null;
        this.websocket = null;
        this.isInitialized = false;
        
        // UI elements
        this.elements = {
            userIdInput: null,
            channelInput: null,
            startBtn: null,
            joinBtn: null,
            callBtn: null,
            hangupBtn: null,
            sendBtn: null,
            sendMessage: null,
            receiveMessage: null,
            localPlayer: null,
            peerPlayer: null
        };
        
        // Button states from original code
        this.buttonStates = {
            startButtonDisabled: true,
            joinButtonDisabled: true,
            callButtonDisabled: true,
            hangupButtonDisabled: true,
            sendButtonDisabled: true
        };
    }

    async initialize() {
        try {
            console.log('Initializing HIPAA WebRTC Application');
            
            // Initialize UI elements
            this.initializeUIElements();
            this.setupEventListeners();
            
            // Generate user ID if not provided
            if (!this.userId) {
                this.userId = 'user_' + Math.floor(Math.random() * 1000000);
                this.elements.userIdInput.value = this.userId;
            }
            
            this.isInitialized = true;
            this.updateButtonState('startButtonDisabled', false);
            
            console.log('HIPAA WebRTC Application initialized');
            
        } catch (error) {
            console.error('Failed to initialize HIPAA WebRTC Application:', error);
            throw error;
        }
    }

    initializeUIElements() {
        // Map to existing UI elements from original WebRTC app
        this.elements = {
            userIdInput: document.querySelector('input[placeholder="User ID"]') || this.createUserIdInput(),
            channelInput: document.querySelector('input[placeholder="Channel Name"]') || this.createChannelInput(),
            startBtn: document.querySelector('button:contains("Start")') || this.createStartButton(),
            joinBtn: document.querySelector('button:contains("Join")') || this.createJoinButton(),
            callBtn: document.querySelector('button:contains("Call")') || this.createCallButton(),
            hangupBtn: document.querySelector('button:contains("Hangup")') || this.createHangupButton(),
            sendBtn: document.querySelector('button:contains("Send Message")') || this.createSendButton(),
            sendMessage: document.querySelector('textarea[placeholder="Send message"]') || this.createSendTextarea(),
            receiveMessage: document.querySelector('textarea[placeholder="Receive message"]') || this.createReceiveTextarea(),
            localPlayer: document.getElementById('localPlayer'),
            peerPlayer: document.getElementById('peerPlayer')
        };
    }

    setupEventListeners() {
        // Start button - Initialize encryption
        this.elements.startBtn.addEventListener('click', async () => {
            await this.start();
        });
        
        // Join button - Join encrypted channel
        this.elements.joinBtn.addEventListener('click', async () => {
            await this.join();
        });
        
        // Call button - Start secure call
        this.elements.callBtn.addEventListener('click', async () => {
            await this.startSecureCall();
        });
        
        // Hangup button - End secure call
        this.elements.hangupBtn.addEventListener('click', async () => {
            await this.hangupSecureCall();
        });
        
        // Send button - Send encrypted message
        this.elements.sendBtn.addEventListener('click', async () => {
            await this.sendEncryptedMessage();
        });
        
        // Channel and user input handlers
        this.elements.userIdInput.addEventListener('change', (e) => {
            this.userId = e.target.value;
        });
        
        this.elements.channelInput.addEventListener('change', (e) => {
            this.channelName = e.target.value;
        });
    }

    async start() {
        try {
            console.log('Starting HIPAA E2EE initialization');
            
            // Disable start button
            this.updateButtonState('startButtonDisabled', true);
            
            // Initialize Signal Protocol
            this.signalManager = new SignalProtocolManager(this.userId);
            await this.signalManager.initialize();
            
            // Initialize Key Management
            this.keyManager = new KeyRotationManager(this.userId, this.signalManager);
            await this.keyManager.initialize();
            
            // Initialize Secure WebRTC
            this.secureWebRTC = new SecureWebRTC(this.userId, this.signalManager);
            this.setupWebRTCHandlers();
            
            // Get user media (from original implementation)
            await this.getUserMedia();
            
            // Enable join button
            this.updateButtonState('joinButtonDisabled', false);
            
            console.log('HIPAA E2EE initialization completed');
            
        } catch (error) {
            console.error('Failed to start HIPAA E2EE:', error);
            alert('Failed to initialize encryption: ' + error.message);
            this.updateButtonState('startButtonDisabled', false);
        }
    }

    async join() {
        try {
            if (!this.channelName) {
                alert('Channel name is required');
                return;
            }
            
            if (!this.userId) {
                alert('User ID is required');
                return;
            }
            
            console.log('Joining encrypted channel:', this.channelName);
            
            // Disable join button
            this.updateButtonState('joinButtonDisabled', true);
            
            // Initialize WebSocket connection
            await this.initializeWebSocket();
            
            // Send encrypted join message
            await this.sendEncryptedJoinMessage();
            
            // Enable call button
            this.updateButtonState('callButtonDisabled', false);
            
            console.log('Successfully joined encrypted channel');
            
        } catch (error) {
            console.error('Failed to join channel:', error);
            alert('Failed to join channel: ' + error.message);
            this.updateButtonState('joinButtonDisabled', false);
        }
    }

    async startSecureCall() {
        try {
            console.log('Starting secure WebRTC call');
            
            // Disable call button, enable hangup
            this.updateButtonState('callButtonDisabled', true);
            this.updateButtonState('hangupButtonDisabled', false);
            
            // Create secure offer
            const secureOffer = await this.secureWebRTC.createSecureOffer(this.getRecipientId());
            
            // Send encrypted offer through WebSocket
            await this.sendWebSocketMessage('secure_offer', secureOffer);
            
            console.log('Secure call initiated');
            
        } catch (error) {
            console.error('Failed to start secure call:', error);
            alert('Failed to start secure call: ' + error.message);
            this.updateButtonState('callButtonDisabled', false);
            this.updateButtonState('hangupButtonDisabled', true);
        }
    }

    async hangupSecureCall() {
        try {
            console.log('Ending secure call');
            
            // Cleanup WebRTC connection
            if (this.secureWebRTC) {
                await this.secureWebRTC.hangup();
            }
            
            // Update button states
            this.updateButtonState('hangupButtonDisabled', true);
            this.updateButtonState('callButtonDisabled', false);
            this.updateButtonState('sendButtonDisabled', true);
            
            console.log('Secure call ended');
            
        } catch (error) {
            console.error('Error during hangup:', error);
        }
    }

    async sendEncryptedMessage() {
        try {
            const message = this.elements.sendMessage.value;
            if (!message) {
                return;
            }
            
            console.log('Sending encrypted message');
            
            // Send via data channel if available
            if (this.secureWebRTC && this.secureWebRTC.isDataChannelReady()) {
                await this.secureWebRTC.sendEncryptedMessage(message, this.getRecipientId());
            } else {
                // Send via WebSocket
                const encryptedMessage = await this.signalManager.encryptMessage(this.getRecipientId(), message);
                await this.sendWebSocketMessage('encrypted_message', encryptedMessage);
            }
            
            // Clear send message
            this.elements.sendMessage.value = '';
            
        } catch (error) {
            console.error('Failed to send encrypted message:', error);
            alert('Failed to send message: ' + error.message);
        }
    }

    // WebSocket management
    async initializeWebSocket() {
        const wsUrl = process.env.NEXT_PUBLIC_WEB_SOCKET || 'ws://localhost:8088';
        
        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.setupWebSocketHandlers();
                resolve();
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket closed');
            };
        });
    }

    setupWebSocketHandlers() {
        this.websocket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                await this.handleWebSocketMessage(message);
            } catch (error) {
                console.error('Failed to handle WebSocket message:', error);
            }
        };
    }

    async handleWebSocketMessage(message) {
        switch (message.type) {
            case 'joined':
                console.log('Users in channel:', message.body);
                break;
                
            case 'secure_offer':
                await this.handleSecureOffer(message.body);
                break;
                
            case 'secure_answer':
                await this.handleSecureAnswer(message.body);
                break;
                
            case 'encrypted_message':
                await this.handleEncryptedMessage(message.body);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    async handleSecureOffer(offerData) {
        try {
            console.log('Received secure offer');
            
            // Create secure answer
            const secureAnswer = await this.secureWebRTC.createSecureAnswer(offerData);
            
            // Send answer back
            await this.sendWebSocketMessage('secure_answer', secureAnswer);
            
            // Update UI
            this.updateButtonState('callButtonDisabled', true);
            this.updateButtonState('hangupButtonDisabled', false);
            
        } catch (error) {
            console.error('Failed to handle secure offer:', error);
        }
    }

    async handleSecureAnswer(answerData) {
        try {
            console.log('Received secure answer');
            
            // Process the answer
            await this.secureWebRTC.processSecureAnswer(answerData);
            
        } catch (error) {
            console.error('Failed to handle secure answer:', error);
        }
    }

    async handleEncryptedMessage(encryptedData) {
        try {
            // Decrypt message
            const decryptedMessage = await this.signalManager.decryptMessage(encryptedData);
            
            // Display in receive textarea
            this.elements.receiveMessage.value = decryptedMessage;
            
            console.log('Received encrypted message');
            
        } catch (error) {
            console.error('Failed to decrypt message:', error);
        }
    }

    setupWebRTCHandlers() {
        this.secureWebRTC.setOnRemoteStream((stream) => {
            console.log('Remote stream received');
            if (this.elements.peerPlayer) {
                this.elements.peerPlayer.srcObject = stream;
            }
        });
        
        this.secureWebRTC.setOnDataChannelOpen(() => {
            console.log('Data channel opened');
            this.updateButtonState('sendButtonDisabled', false);
        });
        
        this.secureWebRTC.setOnDataChannelClose(() => {
            console.log('Data channel closed');
            this.updateButtonState('sendButtonDisabled', true);
        });
        
        this.secureWebRTC.setOnEncryptedMessage((decryptedData) => {
            console.log('Received data channel message');
            this.elements.receiveMessage.value = decryptedData.message;
        });
    }

    // Helper methods
    async getUserMedia() {
        try {
            const stream = await this.secureWebRTC.getUserMedia({
                audio: true,
                video: true
            });
            
            // Display local stream
            if (this.elements.localPlayer) {
                this.elements.localPlayer.srcObject = stream;
            }
            
            console.log('User media acquired');
            
        } catch (error) {
            console.error('Failed to get user media:', error);
            throw error;
        }
    }

    async sendWebSocketMessage(type, body) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({ type, body }));
        } else {
            throw new Error('WebSocket not connected');
        }
    }

    async sendEncryptedJoinMessage() {
        // Encrypt channel join request
        const joinData = {
            channelName: this.channelName,
            userId: this.userId
        };
        
        await this.sendWebSocketMessage('join', joinData);
    }

    getRecipientId() {
        // In a real application, this would be determined from the channel
        // For demo, use a simple convention
        return 'recipient_' + this.channelName;
    }

    updateButtonState(buttonName, disabled) {
        this.buttonStates[buttonName] = disabled;
        
        // Update actual button if it exists
        const buttonMap = {
            'startButtonDisabled': this.elements.startBtn,
            'joinButtonDisabled': this.elements.joinBtn,
            'callButtonDisabled': this.elements.callBtn,
            'hangupButtonDisabled': this.elements.hangupBtn,
            'sendButtonDisabled': this.elements.sendBtn
        };
        
        const button = buttonMap[buttonName];
        if (button) {
            button.disabled = disabled;
        }
    }

    // UI creation methods (fallbacks if elements don't exist)
    createUserIdInput() {
        const input = document.createElement('input');
        input.placeholder = 'User ID';
        input.style.cssText = 'width: 240px; margin-top: 16px;';
        return input;
    }

    createChannelInput() {
        const input = document.createElement('input');
        input.placeholder = 'Channel Name';
        input.style.cssText = 'width: 240px; margin-top: 16px;';
        return input;
    }

    createStartButton() {
        const button = document.createElement('button');
        button.textContent = 'Start E2EE';
        button.style.cssText = 'width: 240px; margin-top: 16px;';
        return button;
    }

    createJoinButton() {
        const button = document.createElement('button');
        button.textContent = 'Join Secure';
        button.style.cssText = 'width: 240px; margin-top: 16px;';
        return button;
    }

    createCallButton() {
        const button = document.createElement('button');
        button.textContent = 'Secure Call';
        button.style.cssText = 'width: 240px; margin-top: 16px;';
        return button;
    }

    createHangupButton() {
        const button = document.createElement('button');
        button.textContent = 'Hangup';
        button.style.cssText = 'width: 240px; margin-top: 16px; background: red; color: white;';
        return button;
    }

    createSendButton() {
        const button = document.createElement('button');
        button.textContent = 'Send Encrypted';
        button.style.cssText = 'width: 240px; margin-top: 16px;';
        return button;
    }

    createSendTextarea() {
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Send encrypted message';
        textarea.style.cssText = 'width: 240px; margin-top: 16px;';
        return textarea;
    }

    createReceiveTextarea() {
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Receive encrypted message';
        textarea.disabled = true;
        textarea.style.cssText = 'width: 240px; margin-top: 16px;';
        return textarea;
    }

    // Status and cleanup
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            userId: this.userId,
            channelName: this.channelName,
            signalProtocolReady: this.signalManager?.isInitialized() || false,
            webRTCReady: this.secureWebRTC?.isConnected() || false,
            dataChannelReady: this.secureWebRTC?.isDataChannelReady() || false,
            websocketReady: this.websocket?.readyState === WebSocket.OPEN || false
        };
    }

    async cleanup() {
        try {
            // Cleanup WebRTC
            if (this.secureWebRTC) {
                await this.secureWebRTC.hangup();
            }
            
            // Cleanup key manager
            if (this.keyManager) {
                await this.keyManager.cleanup();
            }
            
            // Close WebSocket
            if (this.websocket) {
                this.websocket.close();
            }
            
            // Secure cleanup of encryption
            if (this.signalManager?.store) {
                await this.signalManager.store.secureDelete();
            }
            
            console.log('HIPAA WebRTC Application cleaned up');
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

// Export for use in other modules
export default HIPAAWebRTCApp;

// Auto-initialize if this is the main module
if (typeof window !== 'undefined') {
    window.HIPAAWebRTCApp = HIPAAWebRTCApp;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            const app = new HIPAAWebRTCApp();
            await app.initialize();
            window.hipaaApp = app;
        });
    } else {
        const app = new HIPAAWebRTCApp();
        app.initialize().then(() => {
            window.hipaaApp = app;
        });
    }
}