const express = require('express');
const router = express.Router();
const dataExportService = require('./dataExportService');
const { authenticateToken, authorizeRoles } = require('../../audit-trail-system/backend/authMiddleware');

// Patient can request their own data
router.post('/export/request', authenticateToken, async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      requesterId: req.user.id,
      requesterType: req.user.role === 'patient' ? 'patient' : req.body.requesterType
    };

    const exportRequest = await dataExportService.createExportRequest(requestData);
    
    res.status(201).json({
      success: true,
      requestId: exportRequest.requestId,
      status: exportRequest.status,
      message: 'Export request created successfully. Please check your email/SMS for verification code.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify export request
router.post('/export/verify/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { verificationCode } = req.body;

    const request = await dataExportService.verifyRequest(requestId, verificationCode);
    
    res.json({
      success: true,
      status: request.status,
      message: 'Verification successful. Your export is being processed.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get export request status
router.get('/export/status/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await dataExportService.getRequestStatus(requestId);
    
    // Check authorization
    if (request.requesterId !== req.user.id && !['admin', 'compliance_officer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized to view this request' });
    }
    
    res.json({
      requestId: request.requestId,
      status: request.status,
      requestDate: request.requestDate,
      dataCategories: request.dataCategories,
      format: request.format,
      exportDetails: request.status === 'completed' ? {
        exportDate: request.exportDetails.exportDate,
        downloadExpiry: request.exportDetails.downloadExpiry,
        remainingDownloads: request.exportDetails.maxDownloads - request.exportDetails.downloadCount
      } : null
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get all export requests (admin only)
router.get('/export/requests', authenticateToken, authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      patientId: req.query.patientId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const requests = await dataExportService.getAllRequests(filters);
    
    res.json({
      requests,
      total: requests.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve export request (admin only)
router.post('/export/approve/:requestId', authenticateToken, authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const approvalDetails = {
      approvedBy: req.user.id,
      approverRole: req.user.role,
      notes: req.body.notes
    };

    const request = await dataExportService.approveRequest(requestId, approvalDetails);
    
    res.json({
      success: true,
      status: request.status,
      message: 'Export request approved and processing started'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reject export request (admin only)
router.post('/export/reject/:requestId', authenticateToken, authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await dataExportService.rejectRequest(requestId, reason);
    
    res.json({
      success: true,
      status: request.status,
      message: 'Export request rejected'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Download exported data
router.get('/export/download/:requestId/:token', async (req, res) => {
  try {
    const { requestId, token } = req.params;
    
    const exportData = await dataExportService.downloadExport(requestId, token);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.fileName}"`);
    res.setHeader('X-Encryption-Key', exportData.encryptionKey);
    
    res.send(exportData.data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Revoke export (admin only)
router.post('/export/revoke/:requestId', authenticateToken, authorizeRoles(['admin', 'security_admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await dataExportService.revokeExport(requestId, reason);
    
    res.json({
      success: true,
      status: request.status,
      message: 'Export has been revoked'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get export audit trail
router.get('/export/audit/:requestId', authenticateToken, authorizeRoles(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await dataExportService.getRequestWithAudit(requestId);
    
    res.json({
      requestId: request.requestId,
      auditLog: request.auditLog
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Cleanup expired exports (scheduled task endpoint)
router.post('/export/cleanup', authenticateToken, authorizeRoles(['admin', 'system']), async (req, res) => {
  try {
    const cleanedCount = await dataExportService.cleanupExpiredExports();
    
    res.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} expired exports`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;