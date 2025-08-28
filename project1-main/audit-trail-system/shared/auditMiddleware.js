const auditService = require('../backend/auditService');

const createAuditMiddleware = (action, resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const startTime = Date.now();
    
    res.send = function(data) {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      const auditData = {
        action: action || req.auditAction || 'API_ACCESS',
        resourceType: resourceType || req.auditResourceType || 'api_endpoint',
        resourceId: req.params.id || req.body.resourceId || 'unknown',
        patientId: req.body.patientId || req.query.patientId || req.params.patientId,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          statusCode: res.statusCode
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID,
        apiEndpoint: req.originalUrl,
        httpMethod: req.method,
        responseTime,
        success,
        errorMessage: !success ? data : undefined,
        userId: req.user?.id || 'anonymous',
        userRole: req.user?.role || 'anonymous',
        userEmail: req.user?.email || 'anonymous@example.com'
      };
      
      auditService.logAudit(auditData).catch(err => {
        console.error('Failed to log audit:', err);
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

const auditPHIAccess = createAuditMiddleware('VIEW_PHI', 'patient_record');
const auditPHIUpdate = createAuditMiddleware('UPDATE_PHI', 'patient_record');
const auditPHIDelete = createAuditMiddleware('DELETE_PHI', 'patient_record');
const auditPHIExport = createAuditMiddleware('EXPORT_PHI', 'patient_record');
const auditLabAccess = createAuditMiddleware('VIEW_LAB_RESULT', 'lab_result');
const auditClaimFile = createAuditMiddleware('FILE_CLAIM', 'insurance_claim');
const auditDocumentAccess = createAuditMiddleware('DOCUMENT_DOWNLOAD', 'document');

const auditLogin = async (user, success, ipAddress, userAgent) => {
  await auditService.logAudit({
    action: success ? 'LOGIN' : 'FAILED_LOGIN',
    resourceType: 'api_endpoint',
    resourceId: 'auth/login',
    userId: user?.id || 'unknown',
    userRole: user?.role || 'unknown',
    userEmail: user?.email || 'unknown',
    ipAddress,
    userAgent,
    success,
    severity: success ? 'low' : 'high',
    details: {
      loginMethod: 'standard',
      timestamp: new Date()
    }
  });
};

const auditLogout = async (user, ipAddress, userAgent, sessionId) => {
  await auditService.logAudit({
    action: 'LOGOUT',
    resourceType: 'api_endpoint',
    resourceId: 'auth/logout',
    userId: user.id,
    userRole: user.role,
    userEmail: user.email,
    ipAddress,
    userAgent,
    sessionId,
    success: true,
    severity: 'low'
  });
};

const auditPermissionDenied = async (user, resource, action, ipAddress) => {
  await auditService.logAudit({
    action: 'PERMISSION_DENIED',
    resourceType: resource.type || 'unknown',
    resourceId: resource.id || 'unknown',
    userId: user?.id || 'unknown',
    userRole: user?.role || 'unknown',
    userEmail: user?.email || 'unknown',
    ipAddress,
    success: false,
    severity: 'critical',
    details: {
      attemptedAction: action,
      reason: 'Insufficient permissions'
    }
  });
};

module.exports = {
  createAuditMiddleware,
  auditPHIAccess,
  auditPHIUpdate,
  auditPHIDelete,
  auditPHIExport,
  auditLabAccess,
  auditClaimFile,
  auditDocumentAccess,
  auditLogin,
  auditLogout,
  auditPermissionDenied
};