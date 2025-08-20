import { ServerAuditService } from '../services/AuditService';
import { authenticate } from '../middleware/auth';
import express from 'express';

const router = express.Router();
const auditService = new ServerAuditService();

// Receive audit logs from mobile
router.post('/audit/sync', authenticate, async (req, res) => {
  try {
    const { entries } = req.body;
    
    // Validate entries
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Invalid entries' });
    }
    
    // Store in Prisma
    await auditService.receiveBatchFromMobile(entries);
    
    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Audit sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get audit logs (for admins)
router.get('/audit/logs', authenticate, async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const logs = await auditService.searchAuditLogs(req.query);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Query failed' });
  }
});

// Generate compliance report
router.get('/audit/report', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const { startDate, endDate } = req.query;
    const report = await auditService.generateComplianceReport(
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Report generation failed' });
  }
});

export default router;
