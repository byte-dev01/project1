# Manual Testing Guide
## HIPAA Medical Chat System with Queue Management

---

## 🚀 Quick Start Testing

### 1. Run Automated Tests

```bash
# Run all tests with the test runner
node test-runner.js

# Or run individual test suites
node test-hipaa-medical-chat.js
node test-queue-system.js
```

### 2. Start the Servers

```bash
# Terminal 1: Start main HIPAA server
node server/hipaa-server.js

# Terminal 2: Start queue server
node server/queue-server.js

# Terminal 3: Start MongoDB (if not running)
mongod --dbpath ./data
```

### 3. Open the Demo Interface

```bash
# Open the demo HTML file in browser
open hipaa-queue-demo.html
# Or on Windows:
start hipaa-queue-demo.html
```

---

## 📋 Manual Test Scenarios

### Test 1: Doctor Login and Queue View

**Steps:**
1. Open demo interface
2. Click "Doctor View"
3. Enter Doctor ID: `doctor_001`
4. Click "Initialize System"

**Expected Results:**
- ✅ System initializes successfully
- ✅ Empty queue displayed
- ✅ "Add Test Patients" button appears
- ✅ Real-time updates enabled

**Verification:**
```javascript
// In browser console
const status = window.medicalChat.getSystemStatus();
console.log('Queue enabled:', status.queueSystem.enabled);
console.log('WebSocket connected:', status.queueSystem.connected);
```

### Test 2: Patient Queue Entry

**Steps:**
1. Open demo in new tab
2. Click "Patient View"
3. Enter Patient ID: `patient_001`
4. Click "Join Queue"
5. Select appointment type: "Consultation"

**Expected Results:**
- ✅ Patient added to queue
- ✅ Position displayed (e.g., "#1 in line")
- ✅ Estimated wait time shown
- ✅ Cannot see other patients' info

**Verification:**
```javascript
// Patient should only see their own position
const view = await window.medicalChat.getPatientQueueView();
console.log('My position:', view.position);
console.log('Can see others?', view.queue === undefined); // Should be true
```

### Test 3: Emergency Priority Escalation

**Steps:**
1. Add 3 normal patients to queue
2. Add emergency patient
3. Check queue order in doctor view

**Expected Results:**
- ✅ Emergency patient jumps to position 1
- ✅ Other patients move back
- ✅ Emergency alert shown to doctor
- ✅ Red highlight on emergency patient

**Test Code:**
```javascript
// Add normal patients
await medicalChat.addPatientToQueue('patient_001', 'doctor_001', 'consultation', 'normal');
await medicalChat.addPatientToQueue('patient_002', 'doctor_001', 'consultation', 'normal');
await medicalChat.addPatientToQueue('patient_003', 'doctor_001', 'consultation', 'normal');

// Add emergency
await medicalChat.addPatientToQueue('patient_emergency', 'doctor_001', 'emergency', 'emergency');

// Check positions
const queue = await medicalChat.getDoctorQueueView();
console.log('First in queue:', queue.queue[0].priority); // Should be "emergency"
```

### Test 4: Encrypted Messaging

**Steps:**
1. Doctor starts consultation with patient
2. Send test message: "Hello, how can I help you?"
3. Check server logs
4. Patient responds

**Expected Results:**
- ✅ Messages appear encrypted in network tab
- ✅ Server logs show encrypted content only
- ✅ Both parties can read messages
- ✅ No PHI in server logs

**Verification:**
```javascript
// Check encryption
const message = "Test medical information";
const encrypted = await medicalChat.signalManager.encryptMessage('patient_001', message);
console.log('Encrypted:', encrypted); // Should be base64 gibberish
console.log('Original:', message);
```

### Test 5: Video Call with WebRTC

**Steps:**
1. Doctor calls next patient
2. Patient accepts video call
3. Verify video/audio streams
4. Check encryption indicators

**Expected Results:**
- ✅ Video call connects within 5 seconds
- ✅ Both video and audio work
- ✅ "Encrypted" badge shown
- ✅ Can switch to audio-only

**Test Commands:**
```javascript
// Start video call
await medicalChat.startSecureCall('patient_001');

// Check WebRTC state
const rtcState = medicalChat.webRTCManager.peerConnection.connectionState;
console.log('WebRTC state:', rtcState); // Should be "connected"

// Verify DTLS encryption
const stats = await medicalChat.webRTCManager.peerConnection.getStats();
stats.forEach(report => {
    if (report.type === 'transport') {
        console.log('DTLS state:', report.dtlsState); // Should be "connected"
    }
});
```

### Test 6: High Load Test (500+ Patients)

**Steps:**
1. Run load test script
2. Monitor performance metrics
3. Check latency measurements

**Test Script:**
```javascript
// Load test function
async function loadTest() {
    console.log('Starting load test with 500 patients...');
    const startTime = Date.now();
    
    for (let i = 0; i < 500; i++) {
        await medicalChat.addPatientToQueue(
            `patient_${1000 + i}`,
            'doctor_001',
            'consultation',
            i < 10 ? 'emergency' : 'normal'
        );
        
        if (i % 50 === 0) {
            console.log(`Added ${i + 1} patients...`);
        }
    }
    
    const duration = Date.now() - startTime;
    console.log(`Added 500 patients in ${duration}ms`);
    
    // Test operations performance
    const opStart = Date.now();
    const position = await medicalChat.queueManager.getPatientPosition('patient_1250', 'doctor_001');
    const opDuration = Date.now() - opStart;
    
    console.log(`Get position operation: ${opDuration}ms (should be <100ms)`);
    
    // Get metrics
    const metrics = medicalChat.getQueueMetrics();
    console.log('Average latency:', metrics.averageLatency);
    console.log('Total updates:', metrics.totalUpdates);
}

// Run it
loadTest();
```

### Test 7: HIPAA Compliance Audit

**Steps:**
1. Perform various operations
2. Check audit logs
3. Verify no PHI exposure

**Audit Check Script:**
```javascript
// Function to check audit logs for PHI
async function checkAuditLogs() {
    // Get recent audit entries (this would connect to your audit system)
    const logs = await medicalChat.hipaaMiddleware.auditLogger.getRecentLogs(100);
    
    // PHI patterns to check
    const phiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /John|Jane|Doe|Smith/i,  // Common names
        /diabetes|cancer|heart/i, // Medical conditions
        /\b\d{1,2}\/\d{1,2}\/\d{4}\b/ // Birth dates
    ];
    
    let phiFound = false;
    logs.forEach(log => {
        const logString = JSON.stringify(log);
        phiPatterns.forEach(pattern => {
            if (pattern.test(logString)) {
                console.error('⚠️ Potential PHI found in log:', pattern);
                phiFound = true;
            }
        });
    });
    
    if (!phiFound) {
        console.log('✅ No PHI found in audit logs');
    }
    
    return !phiFound;
}

// Run audit check
checkAuditLogs();
```

### Test 8: Queue Persistence (Server Restart)

**Steps:**
1. Add patients to queue
2. Stop queue server (Ctrl+C)
3. Restart queue server
4. Check if queue restored

**Expected Results:**
- ✅ Queue state persists
- ✅ Patient positions maintained
- ✅ No data loss

**Test Commands:**
```bash
# Terminal 1: Add patients
node -e "
const chat = require('./client/js/HIPAAMedicalChatWithQueue.js');
// Add patients...
"

# Terminal 2: Stop server
# Ctrl+C in queue-server terminal

# Terminal 3: Restart server
node server/queue-server.js

# Terminal 4: Verify queue
node -e "
const chat = require('./client/js/HIPAAMedicalChatWithQueue.js');
// Check queue state...
"
```

---

## 🔍 Performance Testing

### Browser Performance Test

```javascript
// Performance measurement in browser
class PerformanceTester {
    constructor() {
        this.metrics = [];
    }
    
    async measureQueueOperation(operation, name) {
        const start = performance.now();
        const result = await operation();
        const duration = performance.now() - start;
        
        this.metrics.push({ name, duration });
        console.log(`${name}: ${duration.toFixed(2)}ms`);
        
        return result;
    }
    
    async runFullTest() {
        // Test queue operations
        await this.measureQueueOperation(
            () => medicalChat.addPatientToQueue('perf_test_1', 'doctor_001', 'consultation', 'normal'),
            'Add Patient'
        );
        
        await this.measureQueueOperation(
            () => medicalChat.getDoctorQueueView('doctor_001'),
            'Get Queue View'
        );
        
        await this.measureQueueOperation(
            () => medicalChat.updatePatientPriority('perf_test_1', 'doctor_001', 'emergency'),
            'Update Priority'
        );
        
        await this.measureQueueOperation(
            () => medicalChat.removePatientFromQueue('perf_test_1', 'doctor_001'),
            'Remove Patient'
        );
        
        // Test encryption
        await this.measureQueueOperation(
            () => medicalChat.signalManager.encryptMessage('test_recipient', 'Test message'),
            'Encrypt Message'
        );
        
        // Summary
        const avg = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;
        console.log(`\nAverage operation time: ${avg.toFixed(2)}ms`);
        console.log('All operations <100ms?', this.metrics.every(m => m.duration < 100));
    }
}

// Run performance test
const tester = new PerformanceTester();
tester.runFullTest();
```

---

## 🛠️ Debugging Tools

### 1. Enable Debug Logging

```javascript
// Enable verbose logging
window.DEBUG = true;
localStorage.setItem('debug', 'hipaa:*');

// Custom logger
class DebugLogger {
    constructor(module) {
        this.module = module;
    }
    
    log(...args) {
        if (window.DEBUG) {
            console.log(`[${this.module}]`, ...args);
        }
    }
    
    error(...args) {
        console.error(`[${this.module}]`, ...args);
    }
}

// Use in testing
const logger = new DebugLogger('QueueTest');
logger.log('Starting queue test...');
```

### 2. Network Monitoring

```javascript
// Monitor WebSocket messages
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
    console.log('WS Send:', JSON.parse(data));
    return originalSend.call(this, data);
};

// Monitor fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('Fetch:', args[0]);
    return originalFetch.apply(this, args);
};
```

### 3. Memory Profiling

```javascript
// Check memory usage
function checkMemory() {
    if (performance.memory) {
        const used = performance.memory.usedJSHeapSize / 1048576;
        const total = performance.memory.totalJSHeapSize / 1048576;
        console.log(`Memory: ${used.toFixed(2)}MB / ${total.toFixed(2)}MB`);
    }
}

// Monitor memory during operations
setInterval(checkMemory, 5000);
```

---

## ✅ Test Checklist

### Core Functionality
- [ ] E2E encryption working
- [ ] WebRTC video calls connect
- [ ] Zero-knowledge server verified
- [ ] HIPAA audit logs clean

### Queue Management
- [ ] Real-time updates (<100ms)
- [ ] Priority queue working
- [ ] Role-based visibility correct
- [ ] 500+ patients supported

### Security
- [ ] No PHI in logs
- [ ] All data encrypted
- [ ] Session management secure
- [ ] Access control enforced

### Performance
- [ ] Queue operations <100ms
- [ ] Message encryption <50ms
- [ ] Video call setup <5s
- [ ] System handles 1000+ connections

---

## 📊 Generate Test Report

After running tests, generate a comprehensive report:

```bash
# Run all tests and generate HTML report
node test-runner.js

# Open the generated report
open test-report.html
```

The report includes:
- Test results summary
- Performance metrics
- Acceptance criteria validation
- Detailed failure information

---

## 🆘 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   ```javascript
   // Check WebSocket status
   console.log('WS State:', medicalChat.queueWebSocket.readyState);
   // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
   ```

2. **Encryption Errors**
   ```javascript
   // Verify Signal Protocol initialization
   console.log('Signal initialized:', medicalChat.signalManager.isInitialized);
   ```

3. **Queue Not Updating**
   ```javascript
   // Check subscriptions
   const metrics = medicalChat.getQueueMetrics();
   console.log('Active subscriptions:', metrics.activeSubscriptions);
   ```

4. **Performance Issues**
   ```javascript
   // Check latency metrics
   const metrics = medicalChat.getQueueMetrics();
   console.log('Average latency:', metrics.averageLatency);
   console.log('Error count:', metrics.errorCount);
   ```

---

*For automated testing, use `test-runner.js`. For manual testing, follow this guide step by step.*