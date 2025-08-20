// Secure Patient Queue Management System
// HIPAA-compliant queue with E2EE and role-based access control

import { generateRandomBytes, arrayBufferToBase64, base64ToArrayBuffer, hashData } from '../utils/crypto.js';

/**
 * Secure Patient Queue Manager
 * Handles encrypted patient queues with HIPAA compliance
 */
class SecureQueueManager {
    constructor(userId, userRole, signalManager, hipaaMiddleware) {
        this.userId = userId;
        this.userRole = userRole; // 'doctor', 'patient', 'admin'
        this.signalManager = signalManager;
        this.hipaaMiddleware = hipaaMiddleware;
        
        // Queue state
        this.queues = new Map(); // doctorId -> encrypted queue
        this.queuePositions = new Map(); // patientId -> position info
        this.priorityQueues = new Map(); // doctorId -> priority queue
        
        // WebSocket connection for real-time updates
        this.wsConnection = null;
        this.isConnected = false;
        
        // Encryption keys for queue data
        this.queueEncryptionKey = null;
        
        // Event handlers
        this.onQueueUpdate = null;
        this.onPositionUpdate = null;
        this.onPriorityAlert = null;
        
        console.log(`SecureQueueManager initialized for ${userRole}: ${userId}`);
    }

    /**
     * Initialize the queue manager with encryption
     */
    async initialize() {
        try {
            console.log('🏥 Initializing Secure Queue Manager...');
            
            // Generate queue encryption key
            this.queueEncryptionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            
            // Initialize WebSocket connection for real-time updates
            await this.initializeWebSocket();
            
            // Load existing queue state
            await this.loadQueueState();
            
            // Log initialization
            await this.hipaaMiddleware.auditLogger.logEvent('queue_system_initialized', {
                userId: this.userId,
                userRole: this.userRole,
                timestamp: Date.now()
            });
            
            console.log('✅ Secure Queue Manager initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize queue manager:', error);
            throw new Error(`Queue manager initialization failed: ${error.message}`);
        }
    }

    /**
     * Add patient to doctor's queue
     */
    async addPatient(patientId, doctorId, appointmentType = 'consultation', priority = 'normal') {
        try {
            // Verify access permissions
            const accessResult = await this.hipaaMiddleware.verifyAccess('queue_management', 'add_patient');
            if (!accessResult.allowed) {
                throw new Error(`Access denied: ${accessResult.reason}`);
            }
            
            console.log(`📝 Adding patient to queue: ${patientId} → Doctor ${doctorId}`);
            
            // Create encrypted patient entry
            const patientEntry = {
                patientId: patientId,
                doctorId: doctorId,
                appointmentType: appointmentType,
                priority: priority,
                joinTime: Date.now(),
                status: 'waiting',
                estimatedWaitTime: await this.calculateWaitTime(doctorId, priority)
            };
            
            // Encrypt patient data
            const encryptedEntry = await this.encryptQueueEntry(patientEntry);
            
            // Add to appropriate queue
            if (priority === 'emergency') {
                await this.addToPriorityQueue(doctorId, encryptedEntry);
            } else {
                await this.addToRegularQueue(doctorId, encryptedEntry);
            }
            
            // Update queue positions
            await this.updateQueuePositions(doctorId);
            
            // Send real-time updates
            await this.broadcastQueueUpdate(doctorId);
            
            // Log queue operation (PHI-free)
            await this.hipaaMiddleware.auditLogger.logEvent('patient_added_to_queue', {
                userId: this.userId,
                doctorId: hashData(doctorId),
                appointmentType: appointmentType,
                priority: priority,
                queueSize: await this.getQueueSize(doctorId),
                timestamp: Date.now()
            });
            
            console.log(`✅ Patient added to queue successfully`);
            return {
                position: await this.getPatientPosition(patientId, doctorId),
                estimatedWaitTime: patientEntry.estimatedWaitTime,
                queueId: `${doctorId}_${Date.now()}`
            };
            
        } catch (error) {
            console.error('❌ Failed to add patient to queue:', error);
            
            // Log failure
            await this.hipaaMiddleware.auditLogger.logEvent('queue_add_failed', {
                userId: this.userId,
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
        }
    }

    /**
     * Remove patient from queue (called or cancelled)
     */
    async removePatient(patientId, doctorId, reason = 'called') {
        try {
            // Verify access permissions
            const accessResult = await this.hipaaMiddleware.verifyAccess('queue_management', 'remove_patient');
            if (!accessResult.allowed) {
                throw new Error(`Access denied: ${accessResult.reason}`);
            }
            
            console.log(`🗑️ Removing patient from queue: ${patientId}`);
            
            // Remove from both regular and priority queues
            const removed = await this.removeFromQueues(patientId, doctorId);
            
            if (removed) {
                // Update positions for remaining patients
                await this.updateQueuePositions(doctorId);
                
                // Broadcast update
                await this.broadcastQueueUpdate(doctorId);
                
                // Log removal (PHI-free)
                await this.hipaaMiddleware.auditLogger.logEvent('patient_removed_from_queue', {
                    userId: this.userId,
                    doctorId: hashData(doctorId),
                    reason: reason,
                    queueSize: await this.getQueueSize(doctorId),
                    timestamp: Date.now()
                });
                
                console.log(`✅ Patient removed from queue`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Failed to remove patient from queue:', error);
            throw error;
        }
    }

    /**
     * Get doctor's queue view (encrypted patient IDs, wait times)
     */
    async getDoctorQueueView(doctorId) {
        try {
            // Verify doctor access
            if (this.userRole !== 'doctor' && this.userRole !== 'admin') {
                throw new Error('Access denied: Doctor view requires doctor or admin role');
            }
            
            // Get priority queue first
            const priorityQueue = await this.getPriorityQueue(doctorId);
            const regularQueue = await this.getRegularQueue(doctorId);
            
            // Combine queues (priority first)
            const combinedQueue = [...priorityQueue, ...regularQueue];
            
            // Decrypt entries for doctor view
            const doctorView = [];
            for (let i = 0; i < combinedQueue.length; i++) {
                const decryptedEntry = await this.decryptQueueEntry(combinedQueue[i]);
                
                doctorView.push({
                    position: i + 1,
                    patientIdHash: hashData(decryptedEntry.patientId), // Hash for display
                    appointmentType: decryptedEntry.appointmentType,
                    priority: decryptedEntry.priority,
                    waitTime: Date.now() - decryptedEntry.joinTime,
                    estimatedWaitTime: decryptedEntry.estimatedWaitTime,
                    status: decryptedEntry.status
                });
            }
            
            // Log queue access
            await this.hipaaMiddleware.auditLogger.logEvent('doctor_queue_accessed', {
                userId: this.userId,
                doctorId: hashData(doctorId),
                queueSize: doctorView.length,
                timestamp: Date.now()
            });
            
            return {
                totalPatients: doctorView.length,
                priorityPatients: priorityQueue.length,
                regularPatients: regularQueue.length,
                queue: doctorView,
                lastUpdated: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Failed to get doctor queue view:', error);
            throw error;
        }
    }

    /**
     * Get patient's queue view (only their position and wait time)
     */
    async getPatientQueueView(patientId, doctorId) {
        try {
            // Verify patient can only see their own position
            if (this.userRole === 'patient' && this.userId !== patientId) {
                throw new Error('Access denied: Patients can only view their own queue position');
            }
            
            const position = await this.getPatientPosition(patientId, doctorId);
            
            if (position === null) {
                return {
                    inQueue: false,
                    message: 'You are not currently in the queue'
                };
            }
            
            const estimatedWaitTime = await this.calculatePatientWaitTime(patientId, doctorId);
            
            // Log patient queue access (PHI-free)
            await this.hipaaMiddleware.auditLogger.logEvent('patient_queue_accessed', {
                userId: this.userId,
                position: position,
                timestamp: Date.now()
            });
            
            return {
                inQueue: true,
                position: position,
                estimatedWaitTime: estimatedWaitTime,
                lastUpdated: Date.now(),
                message: `You are #${position} in line. Estimated wait: ${Math.ceil(estimatedWaitTime / 60000)} minutes`
            };
            
        } catch (error) {
            console.error('❌ Failed to get patient queue view:', error);
            throw error;
        }
    }

    /**
     * Get admin queue overview (all doctors, queue sizes)
     */
    async getAdminQueueOverview() {
        try {
            // Verify admin access
            if (this.userRole !== 'admin') {
                throw new Error('Access denied: Admin role required');
            }
            
            const overview = [];
            
            for (const [doctorId, queue] of this.queues) {
                const priorityCount = this.priorityQueues.get(doctorId)?.length || 0;
                const regularCount = queue.length;
                const totalCount = priorityCount + regularCount;
                
                overview.push({
                    doctorId: hashData(doctorId),
                    totalPatients: totalCount,
                    priorityPatients: priorityCount,
                    regularPatients: regularCount,
                    averageWaitTime: await this.calculateAverageWaitTime(doctorId),
                    lastActivity: await this.getLastQueueActivity(doctorId)
                });
            }
            
            // Log admin access
            await this.hipaaMiddleware.auditLogger.logEvent('admin_queue_overview_accessed', {
                userId: this.userId,
                totalDoctors: overview.length,
                totalPatients: overview.reduce((sum, doc) => sum + doc.totalPatients, 0),
                timestamp: Date.now()
            });
            
            return {
                doctors: overview,
                systemStats: {
                    totalQueues: this.queues.size,
                    totalPatients: overview.reduce((sum, doc) => sum + doc.totalPatients, 0),
                    emergencyCount: overview.reduce((sum, doc) => sum + doc.priorityPatients, 0)
                },
                lastUpdated: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Failed to get admin queue overview:', error);
            throw error;
        }
    }

    /**
     * Update patient priority (emergency escalation)
     */
    async updatePatientPriority(patientId, doctorId, newPriority) {
        try {
            // Verify access permissions
            const accessResult = await this.hipaaMiddleware.verifyAccess('queue_management', 'update_priority');
            if (!accessResult.allowed) {
                throw new Error(`Access denied: ${accessResult.reason}`);
            }
            
            console.log(`🚨 Updating patient priority: ${patientId} → ${newPriority}`);
            
            // Find and remove patient from current queue
            const patientEntry = await this.findAndRemovePatient(patientId, doctorId);
            
            if (!patientEntry) {
                throw new Error('Patient not found in queue');
            }
            
            // Update priority
            const decryptedEntry = await this.decryptQueueEntry(patientEntry);
            decryptedEntry.priority = newPriority;
            decryptedEntry.priorityChangeTime = Date.now();
            
            // Re-encrypt and add to appropriate queue
            const updatedEntry = await this.encryptQueueEntry(decryptedEntry);
            
            if (newPriority === 'emergency') {
                await this.addToPriorityQueue(doctorId, updatedEntry);
                
                // Alert doctor of emergency
                await this.sendEmergencyAlert(doctorId, patientId);
            } else {
                await this.addToRegularQueue(doctorId, updatedEntry);
            }
            
            // Update positions
            await this.updateQueuePositions(doctorId);
            
            // Broadcast updates
            await this.broadcastQueueUpdate(doctorId);
            
            // Log priority change
            await this.hipaaMiddleware.auditLogger.logEvent('patient_priority_updated', {
                userId: this.userId,
                newPriority: newPriority,
                doctorId: hashData(doctorId),
                timestamp: Date.now()
            });
            
            console.log(`✅ Patient priority updated successfully`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to update patient priority:', error);
            throw error;
        }
    }

    // Private helper methods

    async encryptQueueEntry(entry) {
        const entryString = JSON.stringify(entry);
        const entryBytes = new TextEncoder().encode(entryString);
        const iv = generateRandomBytes(12);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.queueEncryptionKey,
            entryBytes
        );
        
        return {
            encryptedData: arrayBufferToBase64(encrypted),
            iv: arrayBufferToBase64(iv),
            timestamp: Date.now()
        };
    }

    async decryptQueueEntry(encryptedEntry) {
        const encryptedData = base64ToArrayBuffer(encryptedEntry.encryptedData);
        const iv = base64ToArrayBuffer(encryptedEntry.iv);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.queueEncryptionKey,
            encryptedData
        );
        
        const entryString = new TextDecoder().decode(decrypted);
        return JSON.parse(entryString);
    }

    async addToPriorityQueue(doctorId, encryptedEntry) {
        if (!this.priorityQueues.has(doctorId)) {
            this.priorityQueues.set(doctorId, []);
        }
        
        const priorityQueue = this.priorityQueues.get(doctorId);
        priorityQueue.unshift(encryptedEntry); // Add to front for priority
        
        // Persist to MongoDB
        await this.persistQueue(doctorId, 'priority');
    }

    async addToRegularQueue(doctorId, encryptedEntry) {
        if (!this.queues.has(doctorId)) {
            this.queues.set(doctorId, []);
        }
        
        const queue = this.queues.get(doctorId);
        queue.push(encryptedEntry); // Add to end for FIFO
        
        // Persist to MongoDB
        await this.persistQueue(doctorId, 'regular');
    }

    async calculateWaitTime(doctorId, priority) {
        // Base wait time calculation
        const averageConsultationTime = 15 * 60 * 1000; // 15 minutes
        
        const priorityCount = this.priorityQueues.get(doctorId)?.length || 0;
        const regularCount = this.queues.get(doctorId)?.length || 0;
        
        if (priority === 'emergency') {
            // Emergency patients go first
            return priorityCount * 5 * 60 * 1000; // 5 minutes per emergency ahead
        } else {
            // Regular patients wait behind all priority + their position
            return (priorityCount * 5 * 60 * 1000) + (regularCount * averageConsultationTime);
        }
    }

    async getPatientPosition(patientId, doctorId) {
        // Check priority queue first
        const priorityQueue = this.priorityQueues.get(doctorId) || [];
        for (let i = 0; i < priorityQueue.length; i++) {
            const decrypted = await this.decryptQueueEntry(priorityQueue[i]);
            if (decrypted.patientId === patientId) {
                return i + 1;
            }
        }
        
        // Check regular queue
        const regularQueue = this.queues.get(doctorId) || [];
        for (let i = 0; i < regularQueue.length; i++) {
            const decrypted = await this.decryptQueueEntry(regularQueue[i]);
            if (decrypted.patientId === patientId) {
                return priorityQueue.length + i + 1;
            }
        }
        
        return null; // Not in queue
    }

    async initializeWebSocket() {
        const wsUrl = `ws://localhost:8088/queue`;
        
        return new Promise((resolve, reject) => {
            try {
                this.wsConnection = new WebSocket(wsUrl);
                
                this.wsConnection.onopen = () => {
                    console.log('📡 Queue WebSocket connected');
                    this.isConnected = true;
                    
                    // Subscribe to queue updates
                    this.wsConnection.send(JSON.stringify({
                        type: 'subscribe_queue_updates',
                        userId: this.userId,
                        userRole: this.userRole
                    }));
                    
                    resolve();
                };
                
                this.wsConnection.onmessage = (event) => {
                    this.handleWebSocketMessage(event);
                };
                
                this.wsConnection.onerror = (error) => {
                    console.error('Queue WebSocket error:', error);
                    reject(error);
                };
                
                this.wsConnection.onclose = () => {
                    console.log('Queue WebSocket disconnected');
                    this.isConnected = false;
                    
                    // Reconnect after 5 seconds
                    setTimeout(() => {
                        this.initializeWebSocket();
                    }, 5000);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'queue_updated':
                    if (this.onQueueUpdate) {
                        this.onQueueUpdate(message.data);
                    }
                    break;
                    
                case 'position_updated':
                    if (this.onPositionUpdate) {
                        this.onPositionUpdate(message.data);
                    }
                    break;
                    
                case 'emergency_alert':
                    if (this.onPriorityAlert) {
                        this.onPriorityAlert(message.data);
                    }
                    break;
                    
                default:
                    console.log('Unknown queue message type:', message.type);
            }
            
        } catch (error) {
            console.error('Failed to handle queue WebSocket message:', error);
        }
    }

    async broadcastQueueUpdate(doctorId) {
        if (this.isConnected) {
            this.wsConnection.send(JSON.stringify({
                type: 'broadcast_queue_update',
                doctorId: doctorId,
                timestamp: Date.now()
            }));
        }
    }

    async persistQueue(doctorId, queueType) {
        // This would integrate with MongoDB in production
        // For now, we'll use localStorage as a placeholder
        const queueData = queueType === 'priority' 
            ? this.priorityQueues.get(doctorId) 
            : this.queues.get(doctorId);
            
        const storageKey = `encrypted_queue_${doctorId}_${queueType}`;
        localStorage.setItem(storageKey, JSON.stringify(queueData || []));
    }

    async loadQueueState() {
        // Load from localStorage (in production, this would be MongoDB)
        const keys = Object.keys(localStorage);
        
        for (const key of keys) {
            if (key.startsWith('encrypted_queue_')) {
                const [, , doctorId, queueType] = key.split('_');
                const queueData = JSON.parse(localStorage.getItem(key));
                
                if (queueType === 'priority') {
                    this.priorityQueues.set(doctorId, queueData);
                } else {
                    this.queues.set(doctorId, queueData);
                }
            }
        }
    }

    // Event handler setters
    setOnQueueUpdate(handler) { this.onQueueUpdate = handler; }
    setOnPositionUpdate(handler) { this.onPositionUpdate = handler; }
    setOnPriorityAlert(handler) { this.onPriorityAlert = handler; }

    // Utility methods
    async getQueueSize(doctorId) {
        const regularSize = this.queues.get(doctorId)?.length || 0;
        const prioritySize = this.priorityQueues.get(doctorId)?.length || 0;
        return regularSize + prioritySize;
    }

    async cleanup() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        
        // Clear encryption keys from memory
        this.queueEncryptionKey = null;
        
        console.log('Secure Queue Manager cleaned up');
    }
}

export default SecureQueueManager;