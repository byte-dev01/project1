# 📹 WebRTC Video Calling Test Guide

## 🚀 Quick Start Testing

### Option 1: Browser-Based Testing (Easiest)

1. **Open the test page directly in your browser:**
```bash
# Just open the HTML file
start test-video-calling.html

# Or on Mac/Linux
open test-video-calling.html
```

2. **Follow the Quick Test sequence:**
   - Click "1. Initialize System" 
   - Click "2. Test Camera" (grant permission)
   - Click "3. Test Encryption"
   - Click "4. Create Offer"
   - Click "5. Simulate Full Call"

### Option 2: Local Development Server

Since Wrangler isn't installed, you can use a simple HTTP server:

```bash
# Using Python (if you have Python installed)
python -m http.server 8000

# Or using Node.js http-server
npx http-server -p 8000

# Or install and use live-server
npx live-server --port=8000
```

Then open: `http://localhost:8000/test-video-calling.html`

---

## 🧪 Testing Video Call Features

### 1. **Basic Camera Test**
```javascript
// In browser console (F12)
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    document.getElementById('localVideo').srcObject = stream;
    console.log('✅ Camera working:', stream.getTracks());
  })
  .catch(err => console.error('❌ Camera error:', err));
```

### 2. **Test Encryption**
```javascript
// Test Signal Protocol encryption
async function testEncryption() {
  const signal = new SignalProtocolManager('test_user');
  await signal.initialize();
  
  const encrypted = await signal.encryptMessage('peer', 'Test message');
  console.log('Encrypted:', encrypted);
  
  return encrypted.content !== 'Test message'; // Should be true
}

testEncryption().then(result => 
  console.log('Encryption working:', result)
);
```

### 3. **Test WebRTC Connection**
```javascript
// Create a test peer connection
const pc = new RTCPeerConnection({
  iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
});

pc.onicecandidate = (e) => {
  if (e.candidate) {
    console.log('ICE candidate:', e.candidate.candidate);
  }
};

// Create offer
pc.createOffer().then(offer => {
  console.log('Offer created:', offer.type);
  return pc.setLocalDescription(offer);
}).then(() => {
  console.log('✅ WebRTC working');
});
```

### 4. **Test Full Medical Chat Integration**
```javascript
// Complete integration test
async function testMedicalChat() {
  // Initialize
  const chat = new HIPAAMedicalChat({
    userId: 'doctor_001',
    debugMode: true
  });
  
  await chat.initialize();
  console.log('✅ System initialized');
  
  // Start consultation
  await chat.startConsultation('patient_001', 'video');
  console.log('✅ Consultation started');
  
  // Send encrypted message
  await chat.sendMedicalMessage('patient_001', 'How are you feeling?');
  console.log('✅ Encrypted message sent');
  
  // Check encryption status
  const status = chat.getSystemStatus();
  console.log('System status:', status);
  
  return status;
}

// Run the test
testMedicalChat().then(console.log).catch(console.error);
```

---

## 🎯 Test Scenarios

### Scenario 1: Doctor Initiates Call
1. Open test page as "Doctor"
2. Enter patient ID
3. Click "Start Video Call"
4. Verify:
   - ✅ Camera activates
   - ✅ Encryption badge shows
   - ✅ Offer is created
   - ✅ SDP is encrypted

### Scenario 2: Patient Receives Call
1. Open test page in second browser/tab as "Patient"
2. Wait for incoming call
3. Accept call
4. Verify:
   - ✅ Both videos connect
   - ✅ Audio works
   - ✅ Encryption active
   - ✅ No PHI exposed

### Scenario 3: Test Data Channel
1. Establish video call
2. Click "Test Data Channel"
3. Send test message
4. Verify:
   - ✅ Message encrypted
   - ✅ Message received
   - ✅ Channel reliable

---

## 🔍 Debugging Video Calls

### Check WebRTC Stats
```javascript
// Get connection stats
async function getCallStats() {
  if (!window.testEnv?.secureWebRTC?.peerConnection) {
    console.log('No active connection');
    return;
  }
  
  const stats = await window.testEnv.secureWebRTC.peerConnection.getStats();
  
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
      console.log('Video Stats:', {
        bytesReceived: report.bytesReceived,
        packetsLost: report.packetsLost,
        jitter: report.jitter,
        frameRate: report.framesPerSecond
      });
    }
  });
}

// Run every second
setInterval(getCallStats, 1000);
```

### Verify Encryption
```javascript
// Check if SDP is encrypted
function checkSDPEncryption() {
  const pc = window.testEnv?.secureWebRTC?.peerConnection;
  if (!pc) return false;
  
  const sdp = pc.localDescription?.sdp || '';
  
  // Check for DTLS fingerprint (indicates encryption)
  const hasDTLS = sdp.includes('a=fingerprint:sha-256');
  const hasSRTP = sdp.includes('RTP/SAVPF');
  
  console.log('Encryption Check:');
  console.log('- DTLS:', hasDTLS);
  console.log('- SRTP:', hasSRTP);
  console.log('- Signal Protocol:', window.testEnv?.signalManager?.isInitialized);
  
  return hasDTLS && hasSRTP;
}

checkSDPEncryption();
```

### Monitor Network Quality
```javascript
// Network quality monitoring
async function monitorNetwork() {
  const pc = window.testEnv?.secureWebRTC?.peerConnection;
  if (!pc) return;
  
  const stats = await pc.getStats();
  let totalPacketsLost = 0;
  let totalPackets = 0;
  
  stats.forEach(report => {
    if (report.type === 'inbound-rtp') {
      totalPacketsLost += report.packetsLost || 0;
      totalPackets += report.packetsReceived || 0;
    }
  });
  
  const lossRate = totalPackets > 0 
    ? (totalPacketsLost / totalPackets * 100).toFixed(2) 
    : 0;
    
  console.log(`📊 Packet loss: ${lossRate}%`);
  
  // Get RTT (Round Trip Time)
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      console.log(`⏱️ RTT: ${report.currentRoundTripTime * 1000}ms`);
    }
  });
}

// Monitor every 2 seconds
setInterval(monitorNetwork, 2000);
```

---

## 🛠️ Troubleshooting

### Issue: Camera not working
```javascript
// Debug camera permissions
navigator.permissions.query({name: 'camera'})
  .then(result => console.log('Camera permission:', result.state));

navigator.permissions.query({name: 'microphone'})  
  .then(result => console.log('Microphone permission:', result.state));
```

### Issue: Connection fails
```javascript
// Check ICE connection state
const pc = window.testEnv?.secureWebRTC?.peerConnection;
if (pc) {
  console.log('ICE State:', pc.iceConnectionState);
  console.log('Connection State:', pc.connectionState);
  
  pc.oniceconnectionstatechange = () => {
    console.log('ICE state changed to:', pc.iceConnectionState);
  };
}
```

### Issue: No video/audio
```javascript
// Check tracks
const pc = window.testEnv?.secureWebRTC?.peerConnection;
if (pc) {
  const senders = pc.getSenders();
  const receivers = pc.getReceivers();
  
  console.log('Sending tracks:', senders.map(s => s.track));
  console.log('Receiving tracks:', receivers.map(r => r.track));
}
```

---

## ✅ Success Criteria

Your video calling is working correctly if:

1. **Camera Test**: ✅ Local video appears
2. **Encryption Test**: ✅ Messages are encrypted (not plaintext)
3. **WebRTC Test**: ✅ Offer/Answer created successfully
4. **Connection Test**: ✅ ICE candidates generated
5. **DTLS Test**: ✅ Fingerprint in SDP
6. **Data Channel**: ✅ Messages can be sent
7. **Full Call**: ✅ Both parties see video

---

## 📊 Expected Performance

- **Connection Time**: < 3 seconds
- **Video Latency**: < 200ms
- **Audio Latency**: < 150ms
- **Packet Loss**: < 1%
- **Encryption Overhead**: < 50ms

---

## 🎉 Quick Success Test

Open the browser console and run:
```javascript
// One-line test
(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({video: true});
  document.body.innerHTML = '<video autoplay></video>';
  document.querySelector('video').srcObject = stream;
  console.log('✅ WebRTC works! You should see video.');
})();
```

If you see your video, WebRTC is working! The HIPAA encryption layers are added on top of this basic functionality.

---

*Use `test-video-calling.html` for the complete interactive testing experience!*