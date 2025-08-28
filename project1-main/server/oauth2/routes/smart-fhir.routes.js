// SMART on FHIR Routes
// Handles SMART App Launch Framework for EHR integrations

const express = require('express');
const router = express.Router();
const passport = require('passport');
const smartController = require('../controllers/smart-fhir.controller');
const { validateSMARTContext, auditLogger } = require('../middleware/oauth2.middleware');

// ============================================================================
// SMART App Launch Flow
// ============================================================================

// Step 1: EHR launches app with launch parameter
// Example: GET /launch?iss=https://fhir.epic.com&launch=abc123
router.get('/launch',
  auditLogger('smart_launch'),
  smartController.handleLaunch
);

// Step 2: App redirects to EHR authorization
// This happens automatically in handleLaunch

// Step 3: EHR redirects back with authorization code
// Example: GET /callback?code=xyz&state=123
router.get('/:ehr/callback',
  auditLogger('smart_callback'),
  (req, res, next) => {
    const ehr = req.params.ehr;
    passport.authenticate(`smart-${ehr}`, {
      failureRedirect: `/error?type=smart_auth_failed&ehr=${ehr}`,
      session: false
    })(req, res, next);
  },
  smartController.handleCallback
);

// ============================================================================
// Standalone Launch (without EHR context)
// ============================================================================

// Initiate standalone launch
router.get('/:ehr/standalone',
  auditLogger('smart_standalone'),
  smartController.initiateStandaloneLaunch
);

// ============================================================================
// FHIR API Proxy Routes
// These routes proxy FHIR requests with proper authentication
// ============================================================================

// Get patient data
router.get('/fhir/Patient/:id',
  smartController.verifyAccessToken,
  smartController.getPatient
);

// Get patient conditions
router.get('/fhir/Condition',
  smartController.verifyAccessToken,
  smartController.getConditions
);

// Get patient medications
router.get('/fhir/MedicationRequest',
  smartController.verifyAccessToken,
  smartController.getMedications
);

// Get patient observations (vitals, lab results)
router.get('/fhir/Observation',
  smartController.verifyAccessToken,
  smartController.getObservations
);

// Get patient allergies
router.get('/fhir/AllergyIntolerance',
  smartController.verifyAccessToken,
  smartController.getAllergies
);

// Get patient immunizations
router.get('/fhir/Immunization',
  smartController.verifyAccessToken,
  smartController.getImmunizations
);

// Generic FHIR resource endpoint
router.get('/fhir/:resourceType',
  smartController.verifyAccessToken,
  smartController.getFHIRResource
);

// ============================================================================
// Token Management
// ============================================================================

// Refresh SMART token
router.post('/token/refresh',
  auditLogger('smart_token_refresh'),
  smartController.refreshToken
);

// Introspect token (check if valid)
router.post('/token/introspect',
  auditLogger('smart_token_introspect'),
  smartController.introspectToken
);

// ============================================================================
// Patient Context Management
// ============================================================================

// Get current patient context
router.get('/context/patient',
  smartController.verifyAccessToken,
  smartController.getPatientContext
);

// Switch patient context (if allowed by EHR)
router.post('/context/patient',
  smartController.verifyAccessToken,
  smartController.switchPatientContext
);

// ============================================================================
// Subscription Management (for real-time updates)
// ============================================================================

// Create FHIR subscription
router.post('/subscription',
  smartController.verifyAccessToken,
  smartController.createSubscription
);

// List subscriptions
router.get('/subscriptions',
  smartController.verifyAccessToken,
  smartController.getSubscriptions
);

// Delete subscription
router.delete('/subscription/:id',
  smartController.verifyAccessToken,
  smartController.deleteSubscription
);

// Webhook endpoint for subscription notifications
router.post('/webhook/:subscriptionId',
  smartController.handleSubscriptionWebhook
);

// ============================================================================
// Bulk Data Export (for population health)
// ============================================================================

// Initiate bulk export
router.post('/bulk-export',
  smartController.verifyAccessToken,
  smartController.initiateBulkExport
);

// Check bulk export status
router.get('/bulk-export/:jobId',
  smartController.verifyAccessToken,
  smartController.getBulkExportStatus
);

// ============================================================================
// Clinical Decision Support (CDS Hooks)
// ============================================================================

// CDS Services discovery
router.get('/cds-services',
  smartController.getCDSServices
);

// CDS Hook endpoint
router.post('/cds-services/:hook',
  smartController.verifyAccessToken,
  smartController.handleCDSHook
);

// ============================================================================
// EHR Configuration Discovery
// ============================================================================

// Discover EHR capabilities
router.get('/:ehr/discover',
  smartController.discoverEHRCapabilities
);

// Get supported resources
router.get('/:ehr/resources',
  smartController.getSupportedResources
);

// ============================================================================
// Testing Endpoints (Development Only)
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  // Test SMART configuration
  router.get('/test/config',
    smartController.testConfiguration
  );

  // Simulate EHR launch
  router.get('/test/simulate-launch',
    smartController.simulateLaunch
  );

  // Get sample patient data
  router.get('/test/sample-patient',
    smartController.getSamplePatient
  );
}

// ============================================================================
// Error Handling
// ============================================================================

router.use((err, req, res, next) => {
  console.error('SMART on FHIR Error:', err);
  
  // Log for HIPAA compliance
  const auditLog = {
    timestamp: new Date().toISOString(),
    event: 'smart_error',
    error: err.message,
    ehr: req.params.ehr || 'unknown',
    resource: req.params.resourceType,
    ip: req.ip
  };
  
  console.log('AUDIT:', auditLog);
  
  // Map SMART errors to user-friendly messages
  const smartErrors = {
    'invalid_scope': 'The app does not have permission to access this data',
    'invalid_patient': 'Patient context is not available',
    'token_expired': 'Your session has expired. Please log in again',
    'ehr_unavailable': 'The EHR system is temporarily unavailable'
  };
  
  const errorMessage = smartErrors[err.code] || 'An error occurred accessing health records';
  
  res.status(err.status || 500).json({
    error: errorMessage,
    code: err.code,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;