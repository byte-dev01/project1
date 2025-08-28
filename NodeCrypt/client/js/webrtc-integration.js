/**
 * WebRTC Integration for NodeCrypt Chat
 * This module adds video/audio calling to existing chat rooms
 * Integrates with the existing WebSocket connection and encryption
 * Includes HIPAA-compliant audit logging for medical use cases
 */

import { roomsData, activeRoomIndex } from './room.js';
import { addSystemMsg } from './chat.js';
import { createElement, $id, addClass, removeClass } from './util.dom.js';
import WebRTCAuditLogger from '../js/hipaa/WebRTCAuditLogger.js';

class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.peers = new Map(); // userId -> RTCPeerConnection
        this.remoteStreams = new Map(); // userId -> MediaStream
        this.isCallActive = false;
        this.videoContainer = null;
        this.localVideo = null;
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        // HIPAA Audit Logger
        this.auditLogger = null;
        this.currentCallId = null;
        this.callStartTime = null;
        this.participants = new Map(); // Track participants for audit
    }

    /**
     * Add video call button to the header
     */
    addVideoCallButton() {
        console.log('Attempting to add video call button');
        const headerActions = document.querySelector('.main-header-actions');
        console.log('Header actions element:', headerActions);
        
        if (headerActions && !document.getElementById('video-call-btn')) {
            console.log('Adding video call button to header');
            const callButton = createElement('button', {
                id: 'video-call-btn',
                class: 'video-call-btn',
                title: 'Start Video Call'
            });
            callButton.innerHTML = '📹';
            callButton.onclick = () => this.toggleVideoCall();
            
            // Insert before the more button
            const moreBtn = headerActions.querySelector('.more-btn');
            if (moreBtn) {
                console.log('Inserting before more button');
                headerActions.insertBefore(callButton, moreBtn);
            } else {
                console.log('Appending to header actions');
                headerActions.appendChild(callButton);
            }
        } else if (document.getElementById('video-call-btn')) {
            console.log('Video call button already exists');
        } else {
            console.log('Header actions not found');
        }
    }

    /**
     * Initialize WebRTC UI components in the chat interface
     */
    initializeUI() {
        console.log('Initializing WebRTC UI');
        const self = this;
        
        // Try to add button immediately if header exists
        setTimeout(() => {
            self.addVideoCallButton();
        }, 100);
        
        // Also hook into renderMainHeader for future renders
        const originalRenderHeader = window.renderMainHeader;
        if (originalRenderHeader) {
            window.renderMainHeader = function() {
                originalRenderHeader.apply(this, arguments);
                // Add our video call button after render
                setTimeout(() => self.addVideoCallButton(), 0);
            };
        }
        
        // Watch for header changes using MutationObserver as backup
        const observer = new MutationObserver(() => {
            self.addVideoCallButton();
        });
        
        // Start observing when document is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                const mainHeader = document.getElementById('main-header');
                if (mainHeader) {
                    observer.observe(mainHeader, { childList: true, subtree: true });
                }
            });
        } else {
            const mainHeader = document.getElementById('main-header');
            if (mainHeader) {
                observer.observe(mainHeader, { childList: true, subtree: true });
            }
        }

        // Create video container (hidden by default)
        if (!document.getElementById('video-container')) {
            const videoContainer = document.createElement('div');
            videoContainer.id = 'video-container';
            videoContainer.className = 'video-container hidden';
            
            videoContainer.innerHTML = `
                <div class="video-grid" id="video-grid">
                    <div class="video-wrapper local-video-wrapper">
                        <video id="local-video" autoplay muted playsinline></video>
                        <div class="video-label">You</div>
                    </div>
                </div>
                <div class="video-controls">
                    <button id="toggle-mic" class="control-btn" type="button">🎤</button>
                    <button id="toggle-camera" class="control-btn" type="button">📷</button>
                    <button id="end-call" class="control-btn danger" type="button">📞</button>
                </div>
            `;
            
            document.body.appendChild(videoContainer);
            this.videoContainer = videoContainer;
            console.log('Video container created:', this.videoContainer);
            this.setupVideoControls();
        } else {
            this.videoContainer = document.getElementById('video-container');
            console.log('Video container already exists:', this.videoContainer);
        }
    }

    /**
     * Setup video control buttons
     */
    setupVideoControls() {
        const toggleMic = $id('toggle-mic');
        const toggleCamera = $id('toggle-camera');
        const endCall = $id('end-call');

        if (toggleMic) {
            toggleMic.onclick = () => this.toggleAudio();
        }
        if (toggleCamera) {
            toggleCamera.onclick = () => this.toggleVideo();
        }
        if (endCall) {
            endCall.onclick = () => this.endCall();
        }
    }

    /**
     * Toggle video call on/off
     */
    async toggleVideoCall() {
        console.log('Toggle video call clicked, isCallActive:', this.isCallActive);
        try {
            if (this.isCallActive) {
                this.endCall();
            } else {
                await this.startCall();
            }
        } catch (error) {
            console.error('Error toggling video call:', error);
            addSystemMsg('Failed to toggle video call: ' + error.message);
        }
    }

    /**
     * Initialize HIPAA audit logger for this call
     */
    async initializeAuditLogger() {
        const room = roomsData[activeRoomIndex];
        if (room) {
            this.auditLogger = new WebRTCAuditLogger(room.myId, room.roomName);
            await this.auditLogger.initialize();
            console.log('HIPAA audit logger initialized for video call');
        }
    }

    /**
     * Start a video call in the current room
     */
    async startCall() {
        console.log('Starting video call...');
        
        if (activeRoomIndex < 0) {
            console.log('No active room');
            addSystemMsg('Please join a room first');
            return;
        }

        try {
            // Initialize audit logger if not already done
            if (!this.auditLogger) {
                await this.initializeAuditLogger();
            }
            
            // Generate call ID and start time
            this.currentCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.callStartTime = Date.now();
            console.log('Requesting user media...');
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log('Got user media stream:', this.localStream);

            // Display local video
            const localVideo = $id('local-video');
            console.log('Local video element:', localVideo);
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }

            // Show video container
            console.log('Video container:', this.videoContainer);
            if (this.videoContainer) {
                this.videoContainer.classList.remove('hidden');
                console.log('Video container shown');
            } else {
                console.error('Video container not found!');
            }
            this.isCallActive = true;

            // Update button
            const callBtn = $id('video-call-btn');
            if (callBtn) {
                callBtn.innerHTML = '📴';
                callBtn.title = 'End Video Call';
            }

            // Send call initiation to room
            this.sendSignal({
                type: 'webrtc_call_start',
                room: roomsData[activeRoomIndex].roomName,
                callId: this.currentCallId
            });

            // Log call start for HIPAA compliance
            const room = roomsData[activeRoomIndex];
            if (this.auditLogger) {
                await this.auditLogger.logCallStart(this.currentCallId, [
                    { userId: room.myId, role: 'initiator' }
                ]);
            }

            addSystemMsg('Video call started');

            // Create peer connections for existing users in room
            if (room.userList) {
                room.userList.forEach(user => {
                    if (user.clientId !== room.myId) {
                        this.createPeerConnection(user.clientId, true);
                    }
                });
            }

        } catch (error) {
            console.error('Failed to start video call:', error);
            addSystemMsg('Failed to access camera/microphone');
        }
    }

    /**
     * Create peer connection for a user
     */
    async createPeerConnection(userId, isInitiator = false) {
        if (this.peers.has(userId)) return;

        const pc = new RTCPeerConnection(this.configuration);
        this.peers.set(userId, pc);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // Handle incoming tracks
        pc.ontrack = (event) => {
            this.handleRemoteStream(userId, event.streams[0]);
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'webrtc_ice_candidate',
                    target: userId,
                    candidate: event.candidate
                });
            }
        };

        // Create offer if initiator
        if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.sendSignal({
                type: 'webrtc_offer',
                target: userId,
                offer: offer
            });
        }

        return pc;
    }

    /**
     * Handle incoming WebRTC signaling messages
     */
    async handleSignal(message) {
        const { type, from, target, offer, answer, candidate } = message;

        // Ignore if not in a call
        if (!this.isCallActive && type !== 'webrtc_call_start') return;

        switch (type) {
            case 'webrtc_call_start':
                // Another user started a call
                if (from !== roomsData[activeRoomIndex]?.myId) {
                    addSystemMsg(`${from} started a video call`);
                    // Store the call ID from the initiator
                    if (message.callId) {
                        this.currentCallId = message.callId;
                    }
                    // Auto-join the call
                    if (!this.isCallActive) {
                        await this.startCall();
                    }
                    // Log participant joined
                    if (this.auditLogger && this.currentCallId) {
                        await this.auditLogger.logParticipantJoined(this.currentCallId, {
                            userId: roomsData[activeRoomIndex]?.myId,
                            role: 'participant',
                            authenticated: true
                        });
                    }
                }
                break;

            case 'webrtc_offer':
                if (target === roomsData[activeRoomIndex]?.myId) {
                    const pc = await this.createPeerConnection(from);
                    await pc.setRemoteDescription(offer);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    this.sendSignal({
                        type: 'webrtc_answer',
                        target: from,
                        answer: answer
                    });
                }
                break;

            case 'webrtc_answer':
                if (target === roomsData[activeRoomIndex]?.myId) {
                    const pc = this.peers.get(from);
                    if (pc) {
                        await pc.setRemoteDescription(answer);
                    }
                }
                break;

            case 'webrtc_ice_candidate':
                if (target === roomsData[activeRoomIndex]?.myId) {
                    const pc = this.peers.get(from);
                    if (pc) {
                        await pc.addIceCandidate(candidate);
                    }
                }
                break;

            case 'webrtc_call_end':
                this.removePeer(from);
                addSystemMsg(`${from} left the call`);
                break;
        }
    }

    /**
     * Handle remote stream
     */
    handleRemoteStream(userId, stream) {
        this.remoteStreams.set(userId, stream);

        // Create video element for remote user
        let remoteVideo = $id(`remote-video-${userId}`);
        if (!remoteVideo) {
            const videoGrid = $id('video-grid');
            const wrapper = createElement('div', {
                class: 'video-wrapper',
                id: `video-wrapper-${userId}`
            });
            
            remoteVideo = createElement('video', {
                id: `remote-video-${userId}`,
                autoplay: true,
                playsinline: true
            });
            
            const label = createElement('div', {
                class: 'video-label'
            });
            label.textContent = userId;
            
            wrapper.appendChild(remoteVideo);
            wrapper.appendChild(label);
            videoGrid.appendChild(wrapper);
        }
        
        remoteVideo.srcObject = stream;
    }

    /**
     * Remove a peer connection
     */
    removePeer(userId) {
        const pc = this.peers.get(userId);
        if (pc) {
            pc.close();
            this.peers.delete(userId);
        }

        this.remoteStreams.delete(userId);

        // Remove video element
        const wrapper = $id(`video-wrapper-${userId}`);
        if (wrapper) {
            wrapper.remove();
        }
    }

    /**
     * End the video call
     */
    async endCall() {
        console.log('Ending video call');
        
        // Log call end for HIPAA compliance
        if (this.auditLogger && this.currentCallId) {
            await this.auditLogger.logCallEnd(this.currentCallId, 'user_ended');
            
            // Save logs to localStorage
            this.auditLogger.saveToLocalStorage();
            
            // Optionally export to JSON file (can be triggered manually)
            // this.auditLogger.exportToJSON();
        }
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        this.peers.forEach((pc, userId) => {
            pc.close();
        });
        this.peers.clear();
        this.remoteStreams.clear();

        // Hide video container
        if (this.videoContainer) {
            this.videoContainer.classList.add('hidden');
        }
        this.isCallActive = false;

        // Reset UI
        const callBtn = $id('video-call-btn');
        if (callBtn) {
            callBtn.innerHTML = '📹';
            callBtn.title = 'Start Video Call';
        }

        // Clear video grid except local video wrapper
        const videoGrid = $id('video-grid');
        if (videoGrid) {
            const remoteWrappers = videoGrid.querySelectorAll('.video-wrapper:not(.local-video-wrapper)');
            remoteWrappers.forEach(wrapper => wrapper.remove());
        }

        // Send call end signal
        this.sendSignal({
            type: 'webrtc_call_end',
            room: roomsData[activeRoomIndex]?.roomName
        });

        addSystemMsg('Video call ended');
    }

    /**
     * Toggle audio on/off
     */
    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const btn = $id('toggle-mic');
                if (btn) {
                    btn.innerHTML = audioTrack.enabled ? '🎤' : '🔇';
                }
            }
        }
    }

    /**
     * Toggle video on/off
     */
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const btn = $id('toggle-camera');
                if (btn) {
                    btn.innerHTML = videoTrack.enabled ? '📷' : '📵';
                }
            }
        }
    }

    /**
     * Send WebRTC signaling through existing WebSocket
     * This will be overridden by webrtc-handler.js to use NodeCrypt
     */
    sendSignal(data) {
        const room = roomsData[activeRoomIndex];
        if (room && room.chat && room.chat.ws && room.chat.ws.readyState === WebSocket.OPEN) {
            // Add sender info
            data.from = room.myId;
            
            // Send through existing NodeCrypt WebSocket
            room.chat.sendMessage(JSON.stringify({
                type: 'webrtc_signal',
                data: data
            }));
        }
    }

    /**
     * Export HIPAA audit logs to JSON file
     */
    exportAuditLogs() {
        if (this.auditLogger) {
            const filename = this.auditLogger.exportToJSON();
            addSystemMsg(`Audit logs exported to ${filename}`);
            return filename;
        } else {
            addSystemMsg('No audit logs available to export');
            return null;
        }
    }

    /**
     * Get audit log summary
     */
    getAuditSummary() {
        if (this.auditLogger) {
            const logs = this.auditLogger.auditLogs;
            return {
                totalEvents: logs.length,
                sessionId: this.auditLogger.sessionId,
                currentCallId: this.currentCallId,
                callActive: this.isCallActive,
                storedSessions: this.auditLogger.constructor.getAllStoredSessions()
            };
        }
        return null;
    }
}

// Create global WebRTC manager instance
window.webRTCManager = new WebRTCManager();

// Make audit functions accessible from console for testing/debugging
window.exportWebRTCAuditLogs = () => window.webRTCManager.exportAuditLogs();
window.getWebRTCAuditSummary = () => window.webRTCManager.getAuditSummary();

// Export for use in other modules
export default window.webRTCManager;