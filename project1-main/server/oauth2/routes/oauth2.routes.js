// OAuth2 Routes
// Handles all OAuth2 authentication endpoints

const express = require('express');
const router = express.Router();
const passport = require('passport');
const oauth2Controller = require('../controllers/oauth2.controller');
const { oauth2RateLimiter, validateState } = require('../middleware/oauth2.middleware');

// Apply rate limiting to all OAuth2 routes
router.use(oauth2RateLimiter);

// ============================================================================
// Google OAuth2 Routes
// ============================================================================

// Initiate Google OAuth2 flow
router.get('/google', 
  validateState, // Generate and validate state parameter for CSRF protection
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

// Google OAuth2 callback
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login?error=oauth2_failed',
    session: false // We'll handle session creation manually
  }),
  oauth2Controller.handleGoogleCallback
);

// ============================================================================
// Generic OAuth2 Routes (for Epic, Cerner, etc.)
// ============================================================================

// Initiate OAuth2 flow for any configured provider
router.get('/:provider',
  validateState,
  (req, res, next) => {
    const provider = req.params.provider;
    const strategyName = `oauth2-${provider}`;
    
    // Check if strategy exists
    if (!passport._strategies[strategyName]) {
      return res.status(404).json({ 
        error: 'OAuth2 provider not configured',
        provider: provider 
      });
    }
    
    passport.authenticate(strategyName)(req, res, next);
  }
);

// OAuth2 callback for any provider
router.get('/:provider/callback',
  (req, res, next) => {
    const provider = req.params.provider;
    const strategyName = `oauth2-${provider}`;
    
    passport.authenticate(strategyName, {
      failureRedirect: `/login?error=oauth2_failed&provider=${provider}`,
      session: false
    })(req, res, next);
  },
  oauth2Controller.handleOAuth2Callback
);

// ============================================================================
// SMART on FHIR Specific Routes
// ============================================================================

// SMART on FHIR launch endpoint (receives launch parameter from EHR)
router.get('/smart/launch',
  oauth2Controller.handleSMARTLaunch
);

// SMART on FHIR ready endpoint (after successful authorization)
router.get('/smart/ready',
  oauth2Controller.handleSMARTReady
);

// ============================================================================
// Token Management Routes
// ============================================================================

// Refresh OAuth2 access token
router.post('/token/refresh',
  oauth2Controller.refreshToken
);

// Revoke OAuth2 token (logout from provider)
router.post('/token/revoke',
  oauth2Controller.revokeToken
);

// Get current token info (for debugging/testing)
router.get('/token/info',
  oauth2Controller.getTokenInfo
);

// ============================================================================
// User Linking Routes
// ============================================================================

// Link existing account with OAuth2 provider
router.post('/link/:provider',
  validateState,
  oauth2Controller.linkAccount
);

// Unlink OAuth2 provider from account
router.delete('/unlink/:provider',
  oauth2Controller.unlinkAccount
);

// Get list of linked OAuth2 providers for current user
router.get('/linked-providers',
  oauth2Controller.getLinkedProviders
);

// ============================================================================
// HIPAA Compliance Routes
// ============================================================================

// Get OAuth2 audit logs for current user (HIPAA requirement)
router.get('/audit-log',
  oauth2Controller.getUserAuditLog
);

// Consent management for OAuth2 data sharing
router.post('/consent',
  oauth2Controller.updateConsent
);

router.get('/consent',
  oauth2Controller.getConsent
);

// ============================================================================
// Testing/Development Routes (disable in production)
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  // Test route to verify OAuth2 configuration
  router.get('/test/config',
    oauth2Controller.testConfiguration
  );
  
  // Mock OAuth2 provider for testing
  router.get('/test/mock-login',
    oauth2Controller.mockOAuth2Login
  );
}

// ============================================================================
// Error Handling
// ============================================================================

// OAuth2 specific error handler
router.use((err, req, res, next) => {
  console.error('OAuth2 Route Error:', err);
  
  // Log error for HIPAA compliance
  const auditLog = {
    timestamp: new Date().toISOString(),
    event: 'oauth2_error',
    error: err.message,
    provider: req.params.provider || 'unknown',
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
  
  // In production, write to audit log file
  console.log('AUDIT:', auditLog);
  
  res.status(500).json({
    error: 'OAuth2 authentication failed',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    redirect: '/login'
  });
});

module.exports = router;