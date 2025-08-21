/**
 * WebRTC Signal Handler for NodeCrypt
 * Handles WebRTC signaling through the existing encrypted NodeCrypt messaging
 */

import webRTCManager from './webrtc-integration.js';
import { roomsData, activeRoomIndex } from './room.js';

/**
 * Handle incoming WebRTC signals from NodeCrypt messages
 * This gets called when we receive a message with type 'webrtc_signal'
 */
export function handleWebRTCSignal(message) {
    // message format from NodeCrypt:
    // {
    //   clientId: 'sender-id',
    //   username: 'sender-username',
    //   type: 'webrtc_signal',
    //   data: { webrtc signal data }
    // }
    
    if (!message || !message.data) return;
    
    const signalData = message.data;
    
    // Add sender info if not present
    if (!signalData.from) {
        signalData.from = message.clientId;
    }
    
    // Handle the WebRTC signal
    webRTCManager.handleSignal(signalData);
}

/**
 * Send WebRTC signal through NodeCrypt encrypted channel
 */
export function sendWebRTCSignal(signalData) {
    const room = roomsData[activeRoomIndex];
    if (!room || !room.chat) return;
    
    // Send as a regular message with type 'webrtc_signal'
    room.chat.sendChannelMessage('webrtc_signal', signalData);
}

/**
 * Initialize WebRTC with NodeCrypt integration
 */
export function initWebRTCIntegration() {
    // Override the sendSignal method to use NodeCrypt
    if (window.webRTCManager) {
        window.webRTCManager.sendSignal = sendWebRTCSignal;
    }
    
    console.log('WebRTC integrated with NodeCrypt messaging');
}

// Export functions
export default {
    handleWebRTCSignal,
    sendWebRTCSignal,
    initWebRTCIntegration
};