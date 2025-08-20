#!/usr/bin/env nodejs

/**
 * HIPAA Queue Server - Real-time WebSocket Updates
 * Extends the existing server with encrypted queue management
 */

'use strict';

const crypto = require('crypto');
const ws = require('ws');
const QueuePersistence = require('./queue-persistence-server.js');

class HIPAAQueueServer {
    constructor(config = {}) {
        this.config = {
            wsHost: config.wsHost || '127.0.0.1',
            wsPort: config.wsPort || 8089, // Different port for queue server
            debug: config.debug || false,
            maxQueuesPerDoctor: config.maxQueuesPerDoctor || 500,
            queueUpdateInterval: config.queueUpdateInterval || 5000, // 5 seconds
            ...config
        };
        
        // Queue management
        this.queueClients = new Map(); // clientId -> { connection, userId, userRole, subscriptions }
        this.doctorQueues = new Map(); // doctorId -> { regular: [], priority: [], metadata: {} }
        this.queueSubscriptions = new Map(); // doctorId -> Set of subscribed clientIds
        
        // Performance tracking
        this.queueMetrics = {
            totalUpdates: 0,
            activeQueues: 0,
            connectedClients: 0,
            averageLatency: 0
        };
        
        // WebSocket server for queue updates
        this.queueWSS = null;
        
        // Persistence layer
        this.persistence = null;
        
        console.log('HIPAA Queue Server initialized');
    }

    /**
     * Start the queue server
     */
    async start() {
        try {
            console.log('🚀 Starting HIPAA Queue Server...');
            
            // Initialize persistence layer
            this.persistence = new QueuePersistence({
                mongoUrl: 'mongodb://localhost:27017/hipaa_queues',
                encryptionEnabled: true
            });
            await this.persistence.initialize();
            
            // Create WebSocket server for queue updates
            this.queueWSS = new ws.Server({
                host: this.config.wsHost,
                port: this.config.wsPort,
                perMessageDeflate: false
            });
            
            console.log(`Queue server started on ${this.config.wsHost}:${this.config.wsPort}`);
            
            // Setup WebSocket event handlers
            this.setupWebSocketHandlers();
            
            // Start periodic queue updates
            this.startQueueUpdateTimer();
            
            // Load existing queue state
            await this.loadQueueState();
            
            console.log('✅ HIPAA Queue Server ready');
            
        } catch (error) {
            console.error('❌ Failed to start queue server:', error);
            throw error;
        }
    }

    setupWebSocketHandlers() {
        this.queueWSS.on('connection', (connection, request) => {
            console.log('📱 New queue client connected');
            
            const clientId = this.generateClientId();
            
            // Initialize client
            this.queueClients.set(clientId, {
                connection: connection,
                userId: null,
                userRole: null,
                subscriptions: new Set(),
                lastSeen: Date.now(),
                authenticated: false
            });
            
            // Setup message handler
            connection.on('message', async (message) => {
                try {
                    await this.handleQueueMessage(clientId, message);
                } catch (error) {
                    console.error('Queue message handling error:', error);
                    this.sendErrorResponse(clientId, 'MESSAGE_ERROR', error.message);
                }
            });
            
            // Setup close handler
            connection.on('close', () => {
                this.handleClientDisconnect(clientId);
            });
            
            // Setup error handler
            connection.on('error', (error) => {
                console.error(`Queue client ${clientId} error:`, error);
                this.handleClientDisconnect(clientId);
            });
            
            // Update metrics
            this.queueMetrics.connectedClients = this.queueClients.size;
        });
    }

    async handleQueueMessage(clientId, message) {
        const client = this.queueClients.get(clientId);
        if (!client) return;
        
        // Update client activity
        client.lastSeen = Date.now();
        
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message.toString());
        } catch (error) {
            this.sendErrorResponse(clientId, 'INVALID_JSON', 'Invalid message format');
            return;
        }
        
        const { type, data } = parsedMessage;
        
        switch (type) {
            case 'authenticate':
                await this.handleAuthentication(clientId, data);
                break;
                
            case 'subscribe_queue_updates':
                await this.handleQueueSubscription(clientId, data);
                break;
                
            case 'add_patient_to_queue':
                await this.handleAddPatient(clientId, data);
                break;
                
            case 'remove_patient_from_queue':
                await this.handleRemovePatient(clientId, data);
                break;
                
            case 'update_patient_priority':
                await this.handleUpdatePriority(clientId, data);
                break;
                
            case 'get_queue_view':
                await this.handleGetQueueView(clientId, data);
                break;
                
            case 'get_patient_position':
                await this.handleGetPatientPosition(clientId, data);
                break;
                
            case 'queue_heartbeat':
                await this.handleHeartbeat(clientId, data);
                break;
                
            default:
                this.sendErrorResponse(clientId, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${type}`);
        }
    }

    async handleAuthentication(clientId, data) {
        const client = this.queueClients.get(clientId);
        const { userId, userRole, authToken } = data;
        
        // Verify authentication (simplified for demo)
        if (!userId || !userRole) {
            this.sendErrorResponse(clientId, 'AUTH_FAILED', 'Missing userId or userRole');
            return;
        }
        
        // Update client info
        client.userId = userId;
        client.userRole = userRole;
        client.authenticated = true;
        
        // Send authentication success
        this.sendMessage(clientId, {
            type: 'auth_success',
            data: {
                userId: userId,
                userRole: userRole,
                serverTime: Date.now()
            }
        });
        
        console.log(`🔐 Client authenticated: ${userId} (${userRole})`);
    }

    async handleQueueSubscription(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (!client.authenticated) {
            this.sendErrorResponse(clientId, 'NOT_AUTHENTICATED', 'Authentication required');
            return;
        }
        
        const { doctorId } = data;
        
        // Verify subscription permissions
        if (client.userRole === 'patient' && client.userId !== data.patientId) {
            this.sendErrorResponse(clientId, 'ACCESS_DENIED', 'Patients can only subscribe to their own updates');
            return;
        }
        
        // Add subscription
        if (!this.queueSubscriptions.has(doctorId)) {
            this.queueSubscriptions.set(doctorId, new Set());
        }
        this.queueSubscriptions.get(doctorId).add(clientId);
        client.subscriptions.add(doctorId);
        
        // Send current queue state
        const queueView = await this.getQueueView(doctorId, client.userRole, client.userId);
        this.sendMessage(clientId, {
            type: 'queue_subscribed',
            data: {
                doctorId: doctorId,
                queueView: queueView
            }
        });
        
        console.log(`📊 Client subscribed to queue: ${doctorId}`);
    }

    async handleAddPatient(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (!client.authenticated) {
            this.sendErrorResponse(clientId, 'NOT_AUTHENTICATED', 'Authentication required');
            return;
        }
        
        // Verify permissions
        if (client.userRole !== 'doctor' && client.userRole !== 'admin') {
            this.sendErrorResponse(clientId, 'ACCESS_DENIED', 'Only doctors and admins can add patients to queue');
            return;
        }
        
        const { patientId, doctorId, appointmentType, priority } = data;
        
        try {
            // Add patient to queue
            const result = await this.addPatientToQueue(patientId, doctorId, appointmentType, priority);
            
            // Broadcast queue update
            await this.broadcastQueueUpdate(doctorId, 'patient_added', {
                patientId: this.hashId(patientId),
                position: result.position,
                estimatedWaitTime: result.estimatedWaitTime
            });
            
            // Send success response
            this.sendMessage(clientId, {
                type: 'patient_added_success',
                data: result
            });
            
            // Log audit event
            await this.logQueueEvent('patient_added_to_queue', {
                userId: client.userId,
                doctorId: this.hashId(doctorId),
                appointmentType: appointmentType,
                priority: priority,
                queueSize: await this.getQueueSize(doctorId)
            });
            
        } catch (error) {
            this.sendErrorResponse(clientId, 'ADD_PATIENT_FAILED', error.message);
        }
    }

    async handleRemovePatient(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (!client.authenticated) {
            this.sendErrorResponse(clientId, 'NOT_AUTHENTICATED', 'Authentication required');
            return;
        }
        
        const { patientId, doctorId, reason } = data;
        
        try {
            // Remove patient from queue
            const removed = await this.removePatientFromQueue(patientId, doctorId, reason);
            
            if (removed) {
                // Broadcast queue update
                await this.broadcastQueueUpdate(doctorId, 'patient_removed', {
                    patientId: this.hashId(patientId),
                    reason: reason
                });
                
                // Send success response
                this.sendMessage(clientId, {
                    type: 'patient_removed_success',
                    data: { patientId: patientId, doctorId: doctorId }
                });
                
                // Log audit event
                await this.logQueueEvent('patient_removed_from_queue', {
                    userId: client.userId,
                    doctorId: this.hashId(doctorId),
                    reason: reason,
                    queueSize: await this.getQueueSize(doctorId)
                });
            } else {
                this.sendErrorResponse(clientId, 'PATIENT_NOT_FOUND', 'Patient not found in queue');
            }
            
        } catch (error) {
            this.sendErrorResponse(clientId, 'REMOVE_PATIENT_FAILED', error.message);
        }
    }

    async handleUpdatePriority(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (!client.authenticated) {
            this.sendErrorResponse(clientId, 'NOT_AUTHENTICATED', 'Authentication required');
            return;
        }
        
        // Verify permissions for priority updates
        if (client.userRole !== 'doctor' && client.userRole !== 'admin') {
            this.sendErrorResponse(clientId, 'ACCESS_DENIED', 'Only doctors and admins can update priority');
            return;
        }
        
        const { patientId, doctorId, newPriority } = data;
        
        try {
            // Update patient priority
            const updated = await this.updatePatientPriority(patientId, doctorId, newPriority);
            
            if (updated) {
                // Broadcast emergency alert if escalated to emergency
                if (newPriority === 'emergency') {
                    await this.broadcastEmergencyAlert(doctorId, patientId);
                }
                
                // Broadcast queue update
                await this.broadcastQueueUpdate(doctorId, 'priority_updated', {
                    patientId: this.hashId(patientId),
                    newPriority: newPriority
                });
                
                // Send success response
                this.sendMessage(clientId, {
                    type: 'priority_updated_success',
                    data: { patientId: patientId, newPriority: newPriority }
                });
                
                // Log audit event
                await this.logQueueEvent('patient_priority_updated', {
                    userId: client.userId,
                    doctorId: this.hashId(doctorId),
                    newPriority: newPriority
                });
            }
            
        } catch (error) {
            this.sendErrorResponse(clientId, 'UPDATE_PRIORITY_FAILED', error.message);
        }
    }

    async handleGetQueueView(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (!client.authenticated) {
            this.sendErrorResponse(clientId, 'NOT_AUTHENTICATED', 'Authentication required');
            return;
        }
        
        const { doctorId } = data;
        
        try {
            const queueView = await this.getQueueView(doctorId, client.userRole, client.userId);
            
            this.sendMessage(clientId, {
                type: 'queue_view_response',
                data: {
                    doctorId: doctorId,
                    queueView: queueView,
                    timestamp: Date.now()
                }
            });
            
        } catch (error) {
            this.sendErrorResponse(clientId, 'GET_QUEUE_FAILED', error.message);
        }
    }

    async handleGetPatientPosition(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (!client.authenticated) {
            this.sendErrorResponse(clientId, 'NOT_AUTHENTICATED', 'Authentication required');
            return;
        }
        
        const { patientId, doctorId } = data;
        
        // Verify patient can only check their own position
        if (client.userRole === 'patient' && client.userId !== patientId) {
            this.sendErrorResponse(clientId, 'ACCESS_DENIED', 'Patients can only check their own position');
            return;
        }
        
        try {
            const position = await this.getPatientPosition(patientId, doctorId);
            const estimatedWaitTime = await this.calculateWaitTime(doctorId, position);
            
            this.sendMessage(clientId, {
                type: 'patient_position_response',
                data: {
                    patientId: patientId,
                    position: position,
                    estimatedWaitTime: estimatedWaitTime,
                    inQueue: position !== null,
                    timestamp: Date.now()
                }
            });
            
        } catch (error) {
            this.sendErrorResponse(clientId, 'GET_POSITION_FAILED', error.message);
        }
    }

    async handleHeartbeat(clientId, data) {
        const client = this.queueClients.get(clientId);
        
        if (client) {
            client.lastSeen = Date.now();
            
            this.sendMessage(clientId, {
                type: 'heartbeat_response',
                data: {
                    serverTime: Date.now(),
                    clientId: clientId
                }
            });
        }
    }

    // Queue management methods

    async addPatientToQueue(patientId, doctorId, appointmentType = 'consultation', priority = 'normal') {
        // Initialize queue if doesn't exist
        if (!this.doctorQueues.has(doctorId)) {
            this.doctorQueues.set(doctorId, {
                regular: [],
                priority: [],
                metadata: {
                    doctorId: doctorId,
                    created: Date.now(),
                    lastUpdated: Date.now()
                }
            });
        }
        
        const queues = this.doctorQueues.get(doctorId);
        
        // Check queue capacity
        const totalPatients = queues.regular.length + queues.priority.length;
        if (totalPatients >= this.config.maxQueuesPerDoctor) {
            throw new Error(`Queue full: Maximum ${this.config.maxQueuesPerDoctor} patients per doctor`);
        }
        
        // Create patient entry
        const patientEntry = {
            patientId: patientId,
            doctorId: doctorId,
            appointmentType: appointmentType,
            priority: priority,
            joinTime: Date.now(),
            status: 'waiting',
            estimatedWaitTime: await this.calculateWaitTime(doctorId, priority)
        };
        
        // Add to appropriate queue
        if (priority === 'emergency') {
            queues.priority.unshift(patientEntry); // Add to front
        } else {
            queues.regular.push(patientEntry); // Add to end
        }
        
        // Update metadata
        queues.metadata.lastUpdated = Date.now();
        
        // Persist to database
        await this.persistence.saveQueue(doctorId, queues);
        
        // Calculate position
        const position = await this.getPatientPosition(patientId, doctorId);
        
        // Update metrics
        this.queueMetrics.totalUpdates++;
        this.queueMetrics.activeQueues = this.doctorQueues.size;
        
        return {
            position: position,
            estimatedWaitTime: patientEntry.estimatedWaitTime,
            queueId: `${doctorId}_${Date.now()}`
        };
    }

    async removePatientFromQueue(patientId, doctorId, reason = 'called') {
        const queues = this.doctorQueues.get(doctorId);
        if (!queues) return false;
        
        // Remove from priority queue
        let removed = false;
        queues.priority = queues.priority.filter(patient => {
            if (patient.patientId === patientId) {
                removed = true;
                return false;
            }
            return true;
        });
        
        // Remove from regular queue if not found in priority
        if (!removed) {
            queues.regular = queues.regular.filter(patient => {
                if (patient.patientId === patientId) {
                    removed = true;
                    return false;
                }
                return true;
            });
        }
        
        if (removed) {
            // Update metadata
            queues.metadata.lastUpdated = Date.now();
            
            // Persist to database
            await this.persistence.saveQueue(doctorId, queues);
            
            // Update metrics
            this.queueMetrics.totalUpdates++;
        }
        
        return removed;
    }

    async getPatientPosition(patientId, doctorId) {
        const queues = this.doctorQueues.get(doctorId);
        if (!queues) return null;
        
        // Check priority queue first
        for (let i = 0; i < queues.priority.length; i++) {
            if (queues.priority[i].patientId === patientId) {
                return i + 1;
            }
        }
        
        // Check regular queue
        for (let i = 0; i < queues.regular.length; i++) {
            if (queues.regular[i].patientId === patientId) {
                return queues.priority.length + i + 1;
            }
        }
        
        return null; // Not in queue
    }

    async calculateWaitTime(doctorId, priorityOrPosition) {
        const averageConsultationTime = 15 * 60 * 1000; // 15 minutes
        const queues = this.doctorQueues.get(doctorId);
        
        if (!queues) return 0;
        
        if (typeof priorityOrPosition === 'string') {
            // Calculate by priority
            const priorityCount = queues.priority.length;
            const regularCount = queues.regular.length;
            
            if (priorityOrPosition === 'emergency') {
                return priorityCount * 5 * 60 * 1000; // 5 minutes per emergency ahead
            } else {
                return (priorityCount * 5 * 60 * 1000) + (regularCount * averageConsultationTime);
            }
        } else {
            // Calculate by position
            const position = priorityOrPosition;
            return (position - 1) * averageConsultationTime;
        }
    }

    async getQueueView(doctorId, userRole, userId) {
        const queues = this.doctorQueues.get(doctorId);
        if (!queues) {
            return {
                totalPatients: 0,
                queue: [],
                lastUpdated: Date.now()
            };
        }
        
        if (userRole === 'doctor' || userRole === 'admin') {
            // Doctor/admin view - show all patients with encrypted IDs
            const combinedQueue = [...queues.priority, ...queues.regular];
            
            return {
                totalPatients: combinedQueue.length,
                priorityPatients: queues.priority.length,
                regularPatients: queues.regular.length,
                queue: combinedQueue.map((patient, index) => ({
                    position: index + 1,
                    patientIdHash: this.hashId(patient.patientId),
                    appointmentType: patient.appointmentType,
                    priority: patient.priority,
                    waitTime: Date.now() - patient.joinTime,
                    estimatedWaitTime: patient.estimatedWaitTime,
                    status: patient.status
                })),
                lastUpdated: Date.now()
            };
            
        } else if (userRole === 'patient') {
            // Patient view - only their position
            const position = await this.getPatientPosition(userId, doctorId);
            
            if (position === null) {
                return {
                    inQueue: false,
                    message: 'You are not currently in the queue'
                };
            }
            
            return {
                inQueue: true,
                position: position,
                estimatedWaitTime: await this.calculateWaitTime(doctorId, position),
                totalPatients: queues.priority.length + queues.regular.length,
                lastUpdated: Date.now()
            };
        }
        
        throw new Error('Invalid user role for queue view');
    }

    // Broadcasting methods

    async broadcastQueueUpdate(doctorId, eventType, eventData) {
        const subscribers = this.queueSubscriptions.get(doctorId);
        if (!subscribers) return;
        
        const updateMessage = {
            type: 'queue_updated',
            data: {
                doctorId: doctorId,
                eventType: eventType,
                eventData: eventData,
                timestamp: Date.now()
            }
        };
        
        // Send to all subscribers
        for (const clientId of subscribers) {
            const client = this.queueClients.get(clientId);
            if (client && client.connection.readyState === ws.OPEN) {
                try {
                    client.connection.send(JSON.stringify(updateMessage));
                } catch (error) {
                    console.error(`Failed to send queue update to ${clientId}:`, error);
                }
            }
        }
        
        // Update metrics
        this.queueMetrics.totalUpdates++;
    }

    async broadcastEmergencyAlert(doctorId, patientId) {
        const subscribers = this.queueSubscriptions.get(doctorId);
        if (!subscribers) return;
        
        const alertMessage = {
            type: 'emergency_alert',
            data: {
                doctorId: doctorId,
                patientIdHash: this.hashId(patientId),
                timestamp: Date.now(),
                message: 'Emergency patient added to queue'
            }
        };
        
        // Send to doctor and admin clients only
        for (const clientId of subscribers) {
            const client = this.queueClients.get(clientId);
            if (client && (client.userRole === 'doctor' || client.userRole === 'admin') && 
                client.connection.readyState === ws.OPEN) {
                try {
                    client.connection.send(JSON.stringify(alertMessage));
                } catch (error) {
                    console.error(`Failed to send emergency alert to ${clientId}:`, error);
                }
            }
        }
    }

    // Utility methods

    generateClientId() {
        return crypto.randomBytes(8).toString('hex');
    }

    hashId(id) {
        return crypto.createHash('sha256').update(id).digest('hex').substring(0, 16);
    }

    sendMessage(clientId, message) {
        const client = this.queueClients.get(clientId);
        if (client && client.connection.readyState === ws.OPEN) {
            try {
                client.connection.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Failed to send message to ${clientId}:`, error);
            }
        }
    }

    sendErrorResponse(clientId, errorCode, errorMessage) {
        this.sendMessage(clientId, {
            type: 'error',
            data: {
                code: errorCode,
                message: errorMessage,
                timestamp: Date.now()
            }
        });
    }

    async logQueueEvent(eventType, data) {
        if (this.persistence) {
            await this.persistence.saveAuditEntry({
                eventType: eventType,
                data: data,
                timestamp: Date.now()
            });
        }
    }

    handleClientDisconnect(clientId) {
        const client = this.queueClients.get(clientId);
        if (!client) return;
        
        // Remove from subscriptions
        for (const doctorId of client.subscriptions) {
            const subscribers = this.queueSubscriptions.get(doctorId);
            if (subscribers) {
                subscribers.delete(clientId);
                if (subscribers.size === 0) {
                    this.queueSubscriptions.delete(doctorId);
                }
            }
        }
        
        // Remove client
        this.queueClients.delete(clientId);
        
        // Update metrics
        this.queueMetrics.connectedClients = this.queueClients.size;
        
        console.log(`📱 Queue client disconnected: ${clientId}`);
    }

    startQueueUpdateTimer() {
        setInterval(() => {
            this.cleanupInactiveClients();
            this.updateQueuePositions();
            this.calculateLatencyMetrics();
        }, this.config.queueUpdateInterval);
        
        console.log(`⏰ Queue update timer started (${this.config.queueUpdateInterval}ms interval)`);
    }

    cleanupInactiveClients() {
        const now = Date.now();
        const timeout = 60000; // 1 minute timeout
        
        for (const [clientId, client] of this.queueClients) {
            if (now - client.lastSeen > timeout) {
                console.log(`🧹 Cleaning up inactive client: ${clientId}`);
                this.handleClientDisconnect(clientId);
            }
        }
    }

    updateQueuePositions() {
        // Recalculate positions and wait times for all queues
        for (const [doctorId, queues] of this.doctorQueues) {
            const hasSubscribers = this.queueSubscriptions.has(doctorId);
            
            if (hasSubscribers) {
                // Update wait times for all patients
                const combinedQueue = [...queues.priority, ...queues.regular];
                
                combinedQueue.forEach((patient, index) => {
                    patient.estimatedWaitTime = this.calculateWaitTime(doctorId, index + 1);
                });
                
                // Broadcast position updates
                this.broadcastQueueUpdate(doctorId, 'positions_updated', {
                    totalPatients: combinedQueue.length
                });
            }
        }
    }

    calculateLatencyMetrics() {
        // Simple latency calculation based on message processing time
        // In production, this would be more sophisticated
        const totalClients = this.queueClients.size;
        const averageLatency = totalClients > 0 ? (this.queueMetrics.totalUpdates / totalClients) * 0.1 : 0;
        
        this.queueMetrics.averageLatency = Math.min(averageLatency, 100); // Cap at 100ms
    }

    async loadQueueState() {
        if (this.persistence) {
            try {
                const queueStates = await this.persistence.loadAllQueues();
                
                for (const state of queueStates) {
                    this.doctorQueues.set(state.doctorId, state.queues);
                }
                
                console.log(`📂 Loaded ${queueStates.length} queue states from database`);
            } catch (error) {
                console.error('Failed to load queue state:', error);
            }
        }
    }

    getMetrics() {
        return {
            ...this.queueMetrics,
            activeQueues: this.doctorQueues.size,
            connectedClients: this.queueClients.size,
            subscriptions: this.queueSubscriptions.size,
            uptime: process.uptime() * 1000
        };
    }

    // Shutdown gracefully
    async shutdown() {
        console.log('🛑 Shutting down HIPAA Queue Server...');
        
        // Save all queue states
        for (const [doctorId, queues] of this.doctorQueues) {
            await this.persistence.saveQueue(doctorId, queues);
        }
        
        // Close all WebSocket connections
        for (const [clientId, client] of this.queueClients) {
            client.connection.close(1001, 'Server shutdown');
        }
        
        // Close WebSocket server
        if (this.queueWSS) {
            this.queueWSS.close();
        }
        
        // Cleanup persistence
        if (this.persistence) {
            await this.persistence.cleanup();
        }
        
        console.log('✅ HIPAA Queue Server shutdown complete');
    }
}

// Export for use
module.exports = HIPAAQueueServer;

// Start server if this is the main module
if (require.main === module) {
    const queueServer = new HIPAAQueueServer({
        debug: true
    });
    
    queueServer.start().catch(error => {
        console.error('Failed to start queue server:', error);
        process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        await queueServer.shutdown();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        await queueServer.shutdown();
        process.exit(0);
    });
}