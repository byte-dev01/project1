const express = require('express');
const router = express.Router();
const auditService = require('./auditService');
const { authenticateToken, authorizeRoles } = require('./authMiddleware');

router.use(authenticateToken);

router.post('/audit/log', async (req, res) => {
  try {
    const auditData = {
      ...req.body,
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionID
    };

    const auditLog = await auditService.logAudit(auditData);
    res.status(201).json({ success: true, auditId: auditLog.auditId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create audit log', message: error.message });
  }
});

router.get('/audit/logs', authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      patientId: req.query.patientId,
      action: req.query.action,
      resourceType: req.query.resourceType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      severity: req.query.severity,
      success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined
    };

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      sortBy: req.query.sortBy || 'timestamp',
      sortOrder: req.query.sortOrder || 'desc'
    };

    const result = await auditService.getAuditLogs(filters, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve audit logs', message: error.message });
  }
});

router.get('/audit/statistics', authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    const statistics = await auditService.getAuditStatistics(timeRange);
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate statistics', message: error.message });
  }
});

router.get('/audit/user/:userId/activity', authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;
    const report = await auditService.getUserActivityReport(userId, days);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate user activity report', message: error.message });
  }
});

router.get('/audit/my-activity', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const report = await auditService.getUserActivityReport(req.user.id, days);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate activity report', message: error.message });
  }
});

router.get('/audit/anomalies', authorizeRoles(['admin', 'security_admin']), async (req, res) => {
  try {
    const anomalies = await auditService.detectAnomalies();
    res.json({ anomalies, timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect anomalies', message: error.message });
  }
});

router.get('/audit/export', authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userId: req.query.userId,
      action: req.query.action
    };
    
    const format = req.query.format || 'json';
    const data = await auditService.exportAuditLogs(filters, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.csv`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.json`);
    }
    
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit logs', message: error.message });
  }
});

module.exports = router;