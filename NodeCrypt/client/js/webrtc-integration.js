/**
 * WebRTC Integration for NodeCrypt Chat
 * This module adds video/audio calling to existing chat rooms
 * Integrates with the existing WebSocket connection and encryption
 */

import { roomsData, activeRoomIndex } from './room.js';
import { addSystemMsg } from './chat.js';
import { createElement, $id, addClass, removeClass } from './util.dom.js';

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
    }

    /**
     * Add video call button to the header
     */
    addVideoCallButton() {
        const headerActions = document.querySelector('.main-header-actions');
        if (headerActions && !document.getElementById('video-call-btn')) {
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
                headerActions.insertBefore(callButton, moreBtn);
            } else {
                headerActions.appendChild(callButton);
            }
        }
    }

    /**
     * Initialize WebRTC UI components in the chat interface
     */
    initializeUI() {
        // Hook into renderMainHeader to add button after each render
        const originalRenderHeader = window.renderMainHeader;
        const self = this;
        
        // Override renderMainHeader function
        window.renderMainHeader = function() {
            // Call original function if it exists
            if (originalRenderHeader && typeof originalRenderHeader === 'function') {
                originalRenderHeader.apply(this, arguments);
            }
            // Add our video call button
            setTimeout(() => self.addVideoCallButton(), 0);
        };

        // Create video container (hidden by default)
        if (!document.getElementById('video-container')) {
            const videoContainer = createElement('div', {
                id: 'video-container',
                class: 'video-container hidden'
            });
            
            videoContainer.innerHTML = `
                <div class="video-grid" id="video-grid">
                    <div class="video-wrapper local-video-wrapper">
                        <video id="local-video" autoplay muted playsinline></video>
                        <div class="video-label">You</div>
                    </div>
                </div>
                <div class="video-controls">
                    <button id="toggle-mic" class="control-btn">🎤</button>
                    <button id="toggle-camera" class="control-btn">📷</button>
                    <button id="end-call" class="control-btn danger">📞</button>
                </div>
            `;
            
            document.body.appendChild(videoContainer);
            this.videoContainer = videoContainer;
            this.setupVideoControls();
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
        if (this.isCallActive) {
            this.endCall();
        } else {
            await this.startCall();
        }
    }

    /**
     * Start a video call in the current room
     */
    async startCall() {
        if (activeRoomIndex < 0) {
            addSystemMsg('Please join a room first');
            return;
        }

        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Display local video
            const localVideo = $id('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }

            // Show video container
            removeClass(this.videoContainer, 'hidden');
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
                room: roomsData[activeRoomIndex].roomName
            });

            addSystemMsg('Video call started');

            // Create peer connections for existing users in room
            const room = roomsData[activeRoomIndex];
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
                    // Auto-join the call
                    if (!this.isCallActive) {
                        await this.startCall();
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
    endCall() {
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
        addClass(this.videoContainer, 'hidden');
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
}

// Create global WebRTC manager instance
window.webRTCManager = new WebRTCManager();

// Export for use in other modules
export default window.webRTCManager;