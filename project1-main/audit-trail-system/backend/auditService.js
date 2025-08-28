const mongoose = require('mongoose');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const auditLogSchema = new mongoose.Schema({
  auditId: { 
    type: String, 
    default: uuidv4,
    unique: true,
    required: true
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    required: true,
    index: true
  },
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  userRole: { 
    type: String, 
    required: true,
    enum: ['doctor', 'nurse', 'admin', 'patient', 'insurance_agent', 'system']
  },
  userEmail: {
    type: String,
    required: true
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'VIEW_PHI', 
      'UPDATE_PHI', 
      'DELETE_PHI', 
      'EXPORT_PHI',
      'SEND_MESSAGE',
      'VIEW_LAB_RESULT',
      'FILE_CLAIM',
      'APPROVE_CLAIM',
      'DENY_CLAIM',
      'LOGIN',
      'LOGOUT',
      'FAILED_LOGIN',
      'PERMISSION_DENIED',
      'API_ACCESS',
      'DOCUMENT_UPLOAD',
      'DOCUMENT_DOWNLOAD',
      'CONSENT_GRANTED',
      'CONSENT_REVOKED'
    ]
  },
  resourceType: { 
    type: String,
    required: true,
    enum: ['patient_record', 'lab_result', 'prescription', 'insurance_claim', 'document', 'message', 'appointment', 'consent_form', 'api_endpoint']
  },
  resourceId: { 
    type: String,
    required: true
  },
  patientId: {
    type: String,
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: { 
    type: String,
    required: true
  },
  userAgent: String,
  sessionId: String,
  location: {
    country: String,
    region: String,
    city: String
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: String,
  apiEndpoint: String,
  httpMethod: String,
  responseTime: Number,
  dataAccessed: [String],
  complianceFlags: {
    hipaaRelevant: { type: Boolean, default: true },
    requiresConsent: { type: Boolean, default: false },
    emergencyAccess: { type: Boolean, default: false }
  }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ patientId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'audit-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'audit-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class AuditService {
  constructor() {
    this.criticalActions = ['DELETE_PHI', 'EXPORT_PHI', 'PERMISSION_DENIED', 'FAILED_LOGIN'];
    this.highSeverityActions = ['UPDATE_PHI', 'APPROVE_CLAIM', 'DENY_CLAIM'];
  }

  determineSeverity(action, success) {
    if (!success) return 'high';
    if (this.criticalActions.includes(action)) return 'critical';
    if (this.highSeverityActions.includes(action)) return 'high';
    if (action.includes('VIEW')) return 'low';
    return 'medium';
  }

  async logAudit(auditData) {
    try {
      const severity = this.determineSeverity(auditData.action, auditData.success !== false);
      
      const auditEntry = new AuditLog({
        ...auditData,
        severity,
        auditId: uuidv4(),
        timestamp: new Date()
      });

      await auditEntry.save();
      
      logger.info('Audit log created', {
        auditId: auditEntry.auditId,
        action: auditEntry.action,
        userId: auditEntry.userId,
        severity
      });

      if (severity === 'critical') {
        this.sendAlertNotification(auditEntry);
      }

      return auditEntry;
    } catch (error) {
      logger.error('Failed to create audit log', { error: error.message, auditData });
      throw error;
    }
  }

  async getAuditLogs(filters = {}, options = {}) {
    try {
      const {
        userId,
        patientId,
        action,
        resourceType,
        startDate,
        endDate,
        severity,
        success
      } = filters;

      const {
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = options;

      const query = {};

      if (userId) query.userId = userId;
      if (patientId) query.patientId = patientId;
      if (action) query.action = action;
      if (resourceType) query.resourceType = resourceType;
      if (severity) query.severity = severity;
      if (success !== undefined) query.success = success;

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(query)
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve audit logs', { error: error.message, filters });
      throw error;
    }
  }

  async getAuditStatistics(timeRange = '24h') {
    try {
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (timeRanges[timeRange] || timeRanges['24h']));

      const stats = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            actionsByType: {
              $push: '$action'
            },
            severityDistribution: {
              $push: '$severity'
            },
            failedActions: {
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            totalActions: 1,
            uniqueUsersCount: { $size: '$uniqueUsers' },
            failedActions: 1,
            actionsByType: 1,
            severityDistribution: 1
          }
        }
      ]);

      const actionCounts = {};
      const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };

      if (stats.length > 0) {
        stats[0].actionsByType.forEach(action => {
          actionCounts[action] = (actionCounts[action] || 0) + 1;
        });
        
        stats[0].severityDistribution.forEach(severity => {
          severityCounts[severity]++;
        });
      }

      const hourlyActivity = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d %H:00',
                date: '$timestamp'
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      return {
        summary: stats[0] || {
          totalActions: 0,
          uniqueUsersCount: 0,
          failedActions: 0
        },
        actionDistribution: actionCounts,
        severityDistribution: severityCounts,
        hourlyActivity: hourlyActivity.map(item => ({
          hour: item._id,
          count: item.count
        })),
        timeRange
      };
    } catch (error) {
      logger.error('Failed to generate audit statistics', { error: error.message });
      throw error;
    }
  }

  async getUserActivityReport(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const userActivity = await AuditLog.aggregate([
        {
          $match: {
            userId,
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              action: '$action'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            actions: {
              $push: {
                action: '$_id.action',
                count: '$count'
              }
            },
            totalActions: { $sum: '$count' }
          }
        },
        {
          $sort: { _id: -1 }
        }
      ]);

      const accessedPatients = await AuditLog.distinct('patientId', {
        userId,
        timestamp: { $gte: startDate },
        patientId: { $exists: true, $ne: null }
      });

      const recentActions = await AuditLog.find({
        userId,
        timestamp: { $gte: startDate }
      })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      return {
        userId,
        period: `${days} days`,
        dailyActivity: userActivity,
        accessedPatientsCount: accessedPatients.length,
        accessedPatients: accessedPatients.slice(0, 10),
        recentActions
      };
    } catch (error) {
      logger.error('Failed to generate user activity report', { error: error.message, userId });
      throw error;
    }
  }

  async detectAnomalies() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const anomalies = [];

      const failedLogins = await AuditLog.aggregate([
        {
          $match: {
            action: 'FAILED_LOGIN',
            timestamp: { $gte: oneHourAgo }
          }
        },
        {
          $group: {
            _id: '$ipAddress',
            count: { $sum: 1 },
            users: { $addToSet: '$userId' }
          }
        },
        {
          $match: {
            count: { $gte: 5 }
          }
        }
      ]);

      failedLogins.forEach(item => {
        anomalies.push({
          type: 'EXCESSIVE_FAILED_LOGINS',
          severity: 'critical',
          details: {
            ipAddress: item._id,
            attempts: item.count,
            targetedUsers: item.users
          }
        });
      });

      const unusualAccess = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: oneHourAgo },
            action: { $in: ['VIEW_PHI', 'EXPORT_PHI'] }
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            patients: { $addToSet: '$patientId' }
          }
        },
        {
          $match: {
            count: { $gte: 50 }
          }
        }
      ]);

      unusualAccess.forEach(item => {
        anomalies.push({
          type: 'UNUSUAL_ACCESS_PATTERN',
          severity: 'high',
          details: {
            userId: item._id,
            accessCount: item.count,
            uniquePatients: item.patients.length
          }
        });
      });

      return anomalies;
    } catch (error) {
      logger.error('Failed to detect anomalies', { error: error.message });
      throw error;
    }
  }

  async sendAlertNotification(auditEntry) {
    logger.warn('CRITICAL AUDIT ALERT', {
      auditId: auditEntry.auditId,
      action: auditEntry.action,
      userId: auditEntry.userId,
      timestamp: auditEntry.timestamp
    });
  }

  async exportAuditLogs(filters, format = 'json') {
    try {
      const { logs } = await this.getAuditLogs(filters, { limit: 10000 });
      
      if (format === 'csv') {
        const csvHeader = 'Timestamp,User ID,User Role,Action,Resource Type,Resource ID,Patient ID,Success,Severity,IP Address\n';
        const csvRows = logs.map(log => 
          `${log.timestamp},${log.userId},${log.userRole},${log.action},${log.resourceType},${log.resourceId},${log.patientId || ''},${log.success},${log.severity},${log.ipAddress}`
        ).join('\n');
        
        return csvHeader + csvRows;
      }
      
      return JSON.stringify(logs, null, 2);
    } catch (error) {
      logger.error('Failed to export audit logs', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AuditService();