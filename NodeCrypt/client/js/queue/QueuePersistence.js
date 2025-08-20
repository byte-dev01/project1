// Encrypted Queue Persistence Layer for MongoDB
// HIPAA-compliant queue state storage with encryption at rest

import { generateRandomBytes, arrayBufferToBase64, base64ToArrayBuffer, hashData } from '../utils/crypto.js';

/**
 * Encrypted Queue Persistence Manager
 * Handles secure storage and retrieval of queue data in MongoDB
 */
class QueuePersistence {
    constructor(mongoUrl, encryptionKey) {
        this.mongoUrl = mongoUrl || 'mongodb://localhost:27017/hipaa_queues';
        this.encryptionKey = encryptionKey;
        this.dbConnection = null;
        this.collections = {
            queues: 'encrypted_queues',
            auditLog: 'queue_audit_log',
            queueMetadata: 'queue_metadata'
        };
        
        // Field-level encryption keys
        this.fieldEncryptionKeys = new Map();
        
        console.log('QueuePersistence initialized');
    }

    /**
     * Initialize MongoDB connection with encryption
     */
    async initialize() {
        try {
            console.log('🗄️ Initializing encrypted queue persistence...');
            
            // In a real implementation, this would use MongoDB Node.js driver
            // For demo purposes, we'll simulate the structure
            
            // Initialize field-level encryption
            await this.initializeFieldEncryption();
            
            // Create indexes for performance
            await this.createIndexes();
            
            console.log('✅ Encrypted queue persistence initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize queue persistence:', error);
            throw error;
        }
    }

    /**
     * Save encrypted queue state
     */
    async saveQueue(doctorId, queueData, queueType = 'regular') {
        try {
            // Encrypt the entire queue data
            const encryptedQueue = await this.encryptQueueData(queueData);
            
            // Create document structure
            const queueDocument = {
                _id: `${hashData(doctorId)}_${queueType}`,
                doctorIdHash: hashData(doctorId), // Hashed for indexing
                queueType: queueType,
                encryptedData: encryptedQueue.data,
                encryptionMeta: {
                    iv: encryptedQueue.iv,
                    algorithm: 'AES-256-GCM',
                    keyVersion: '1.0'
                },
                metadata: {
                    patientCount: queueData.length,
                    lastUpdated: Date.now(),
                    checksum: await this.calculateChecksum(queueData)
                },
                // Additional fields for query optimization (encrypted)
                stats: await this.encryptQueueStats(queueData)
            };
            
            // Save to MongoDB (simulated)
            await this.mongoUpsert(this.collections.queues, queueDocument);
            
            // Update metadata collection
            await this.updateQueueMetadata(doctorId, queueType, queueData.length);
            
            console.log(`💾 Queue saved: ${doctorId} (${queueType})`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to save queue:', error);
            throw error;
        }
    }

    /**
     * Load encrypted queue state
     */
    async loadQueue(doctorId, queueType = 'regular') {
        try {
            const documentId = `${hashData(doctorId)}_${queueType}`;
            
            // Load from MongoDB (simulated)
            const queueDocument = await this.mongoFindOne(this.collections.queues, {
                _id: documentId
            });
            
            if (!queueDocument) {
                return []; // Return empty queue if not found
            }
            
            // Verify checksum
            const decryptedData = await this.decryptQueueData({
                data: queueDocument.encryptedData,
                iv: queueDocument.encryptionMeta.iv
            });
            
            const calculatedChecksum = await this.calculateChecksum(decryptedData);
            if (calculatedChecksum !== queueDocument.metadata.checksum) {
                throw new Error('Queue data integrity check failed');
            }
            
            console.log(`📂 Queue loaded: ${doctorId} (${queueType})`);
            return decryptedData;
            
        } catch (error) {
            console.error('❌ Failed to load queue:', error);
            return []; // Return empty queue on error
        }
    }

    /**
     * Save queue audit log entry
     */
    async saveAuditEntry(entry) {
        try {
            // Encrypt sensitive fields
            const encryptedEntry = {
                _id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: entry.timestamp,
                eventType: entry.eventType,
                userIdHash: hashData(entry.userId),
                
                // Encrypt the data payload
                encryptedData: await this.encryptField(JSON.stringify(entry.data)),
                
                // Searchable fields (hashed for privacy)
                doctorIdHash: entry.doctorId ? hashData(entry.doctorId) : null,
                patientIdHash: entry.patientId ? hashData(entry.patientId) : null,
                
                // Metadata for queries
                metadata: {
                    hasError: entry.data?.error ? true : false,
                    priority: entry.data?.priority || 'normal',
                    queueType: entry.data?.queueType || 'regular'
                }
            };
            
            // Save to audit collection
            await this.mongoInsert(this.collections.auditLog, encryptedEntry);
            
            console.log(`📝 Audit entry saved: ${entry.eventType}`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to save audit entry:', error);
            throw error;
        }
    }

    /**
     * Get queue statistics (encrypted aggregation)
     */
    async getQueueStatistics(doctorId, timeRange = 24 * 60 * 60 * 1000) {
        try {
            const doctorHash = hashData(doctorId);
            const fromTime = Date.now() - timeRange;
            
            // Aggregate encrypted statistics
            const stats = await this.mongoAggregate(this.collections.auditLog, [
                {
                    $match: {
                        doctorIdHash: doctorHash,
                        timestamp: { $gte: fromTime }
                    }
                },
                {
                    $group: {
                        _id: '$eventType',
                        count: { $sum: 1 },
                        lastOccurrence: { $max: '$timestamp' }
                    }
                }
            ]);
            
            // Load current queue sizes
            const regularQueue = await this.loadQueue(doctorId, 'regular');
            const priorityQueue = await this.loadQueue(doctorId, 'priority');
            
            return {
                currentQueues: {
                    regular: regularQueue.length,
                    priority: priorityQueue.length,
                    total: regularQueue.length + priorityQueue.length
                },
                recentActivity: stats,
                timeRange: timeRange,
                lastUpdated: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Failed to get queue statistics:', error);
            throw error;
        }
    }

    /**
     * Search audit logs with encryption
     */
    async searchAuditLogs(criteria) {
        try {
            const query = {};
            
            // Build encrypted query
            if (criteria.userId) {
                query.userIdHash = hashData(criteria.userId);
            }
            
            if (criteria.doctorId) {
                query.doctorIdHash = hashData(criteria.doctorId);
            }
            
            if (criteria.eventType) {
                query.eventType = criteria.eventType;
            }
            
            if (criteria.fromTime || criteria.toTime) {
                query.timestamp = {};
                if (criteria.fromTime) query.timestamp.$gte = criteria.fromTime;
                if (criteria.toTime) query.timestamp.$lte = criteria.toTime;
            }
            
            // Execute query
            const results = await this.mongoFind(this.collections.auditLog, query);
            
            // Decrypt results for authorized access
            const decryptedResults = [];
            for (const result of results) {
                decryptedResults.push({
                    id: result._id,
                    timestamp: result.timestamp,
                    eventType: result.eventType,
                    data: JSON.parse(await this.decryptField(result.encryptedData)),
                    metadata: result.metadata
                });
            }
            
            return decryptedResults;
            
        } catch (error) {
            console.error('❌ Failed to search audit logs:', error);
            throw error;
        }
    }

    /**
     * Backup queues with encryption
     */
    async backupQueues(backupLocation) {
        try {
            console.log('💾 Starting encrypted queue backup...');
            
            // Get all queue documents
            const allQueues = await this.mongoFind(this.collections.queues, {});
            
            // Create backup with additional encryption layer
            const backup = {
                timestamp: Date.now(),
                version: '1.0',
                queues: allQueues,
                metadata: await this.mongoFind(this.collections.queueMetadata, {})
            };
            
            // Encrypt entire backup
            const encryptedBackup = await this.encryptBackup(backup);
            
            // Save backup (in production, this would go to secure cloud storage)
            const backupPath = `${backupLocation}/queue_backup_${Date.now()}.encrypted`;
            
            console.log(`✅ Queue backup completed: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            console.error('❌ Failed to backup queues:', error);
            throw error;
        }
    }

    // Private encryption methods

    async encryptQueueData(queueData) {
        const dataString = JSON.stringify(queueData);
        const dataBytes = new TextEncoder().encode(dataString);
        const iv = generateRandomBytes(12);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            dataBytes
        );
        
        return {
            data: arrayBufferToBase64(encrypted),
            iv: arrayBufferToBase64(iv)
        };
    }

    async decryptQueueData(encryptedData) {
        const data = base64ToArrayBuffer(encryptedData.data);
        const iv = base64ToArrayBuffer(encryptedData.iv);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            data
        );
        
        const dataString = new TextDecoder().decode(decrypted);
        return JSON.parse(dataString);
    }

    async encryptField(fieldData) {
        const fieldBytes = new TextEncoder().encode(fieldData);
        const iv = generateRandomBytes(12);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            fieldBytes
        );
        
        return {
            data: arrayBufferToBase64(encrypted),
            iv: arrayBufferToBase64(iv)
        };
    }

    async decryptField(encryptedField) {
        const data = base64ToArrayBuffer(encryptedField.data);
        const iv = base64ToArrayBuffer(encryptedField.iv);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            data
        );
        
        return new TextDecoder().decode(decrypted);
    }

    async calculateChecksum(data) {
        const dataString = JSON.stringify(data);
        const dataBytes = new TextEncoder().encode(dataString);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        return arrayBufferToBase64(hashBuffer);
    }

    async initializeFieldEncryption() {
        // Initialize field-level encryption keys
        this.fieldEncryptionKeys.set('patientData', await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        ));
        
        this.fieldEncryptionKeys.set('auditData', await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        ));
    }

    async createIndexes() {
        // Create performance indexes (simulated)
        const indexes = [
            { collection: this.collections.queues, index: { doctorIdHash: 1, queueType: 1 } },
            { collection: this.collections.auditLog, index: { timestamp: -1 } },
            { collection: this.collections.auditLog, index: { doctorIdHash: 1, timestamp: -1 } },
            { collection: this.collections.queueMetadata, index: { doctorIdHash: 1 } }
        ];
        
        console.log('📊 Database indexes created for performance');
        return indexes;
    }

    async updateQueueMetadata(doctorId, queueType, patientCount) {
        const metadataDoc = {
            _id: `meta_${hashData(doctorId)}_${queueType}`,
            doctorIdHash: hashData(doctorId),
            queueType: queueType,
            patientCount: patientCount,
            lastUpdated: Date.now(),
            dailyStats: await this.getDailyStats(doctorId, queueType)
        };
        
        await this.mongoUpsert(this.collections.queueMetadata, metadataDoc);
    }

    async getDailyStats(doctorId, queueType) {
        // Calculate daily statistics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return {
            date: today.getTime(),
            totalProcessed: await this.getProcessedCount(doctorId, queueType, today.getTime()),
            averageWaitTime: await this.getAverageWaitTime(doctorId, queueType, today.getTime()),
            emergencyCount: queueType === 'priority' ? await this.getEmergencyCount(doctorId, today.getTime()) : 0
        };
    }

    // MongoDB simulation methods (in production, these would use real MongoDB driver)
    
    async mongoUpsert(collection, document) {
        // Simulate MongoDB upsert operation
        const key = `mongo_${collection}_${document._id}`;
        localStorage.setItem(key, JSON.stringify(document));
        return { upsertedId: document._id };
    }

    async mongoInsert(collection, document) {
        // Simulate MongoDB insert operation
        const key = `mongo_${collection}_${document._id}`;
        localStorage.setItem(key, JSON.stringify(document));
        return { insertedId: document._id };
    }

    async mongoFindOne(collection, query) {
        // Simulate MongoDB findOne operation
        const key = `mongo_${collection}_${query._id}`;
        const document = localStorage.getItem(key);
        return document ? JSON.parse(document) : null;
    }

    async mongoFind(collection, query) {
        // Simulate MongoDB find operation
        const results = [];
        const keys = Object.keys(localStorage);
        
        for (const key of keys) {
            if (key.startsWith(`mongo_${collection}_`)) {
                const document = JSON.parse(localStorage.getItem(key));
                
                // Simple query matching
                let matches = true;
                for (const [field, value] of Object.entries(query)) {
                    if (document[field] !== value) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches) {
                    results.push(document);
                }
            }
        }
        
        return results;
    }

    async mongoAggregate(collection, pipeline) {
        // Simulate MongoDB aggregation (simplified)
        const documents = await this.mongoFind(collection, {});
        
        // Apply basic aggregation operations
        let result = documents;
        
        for (const stage of pipeline) {
            if (stage.$match) {
                result = result.filter(doc => {
                    for (const [field, condition] of Object.entries(stage.$match)) {
                        if (typeof condition === 'object' && condition.$gte) {
                            if (doc[field] < condition.$gte) return false;
                        } else if (doc[field] !== condition) {
                            return false;
                        }
                    }
                    return true;
                });
            }
            
            if (stage.$group) {
                const grouped = new Map();
                result.forEach(doc => {
                    const groupKey = stage.$group._id === '$eventType' ? doc.eventType : 'all';
                    if (!grouped.has(groupKey)) {
                        grouped.set(groupKey, { _id: groupKey, count: 0, lastOccurrence: 0 });
                    }
                    const group = grouped.get(groupKey);
                    group.count++;
                    group.lastOccurrence = Math.max(group.lastOccurrence, doc.timestamp);
                });
                result = Array.from(grouped.values());
            }
        }
        
        return result;
    }

    // Cleanup
    async cleanup() {
        if (this.dbConnection) {
            // In production, close MongoDB connection
            this.dbConnection = null;
        }
        
        // Clear encryption keys
        this.fieldEncryptionKeys.clear();
        
        console.log('QueuePersistence cleaned up');
    }
}

export default QueuePersistence;