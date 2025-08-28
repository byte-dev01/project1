// OAuth2 Middleware
// Security and validation middleware for OAuth2 routes

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const config = require('../config/oauth2.config');
const jwt = require('jsonwebtoken');

// Rate limiter for OAuth2 endpoints
const oauth2RateLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.max,
  message: config.rateLimiting.message,
  standardHeaders: true,
  legacyHeaders: false,
  // Store in memory (use Redis in production)
  store: new rateLimit.MemoryStore(),
  // Skip successful requests from rate limit
  skipSuccessfulRequests: false,
  // Handler for when rate limit is exceeded
  handler: (req, res) => {
    // HIPAA Audit Log for rate limit violations
    console.log('AUDIT: Rate Limit Exceeded', {
      ip: req.ip,
      endpoint: req.originalUrl,
      timestamp: new Date().toISOString(),
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Too many requests',
      message: config.rateLimiting.message,
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Generate and validate state parameter for CSRF protection
const validateState = (req, res, next) => {
  if (req.method === 'GET' && !req.query.state) {
    // Generate new state for initial OAuth2 request
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session
    req.session.oauth2State = state;
    req.session.oauth2StateCreated = Date.now();
    
    // Add state to query parameters
    req.query.state = state;
  } else if (req.query.state) {
    // Validate state for callback
    const sessionState = req.session.oauth2State;
    const stateAge = Date.now() - (req.session.oauth2StateCreated || 0);
    
    // State expires after 10 minutes
    if (!sessionState || req.query.state !== sessionState || stateAge > 600000) {
      console.log('AUDIT: Invalid OAuth2 State', {
        ip: req.ip,
        providedState: req.query.state,
        hasSessionState: !!sessionState,
        stateAge: stateAge,
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        error: 'Invalid state parameter',
        message: 'CSRF validation failed'
      });
    }
    
    // Clear state after validation
    delete req.session.oauth2State;
    delete req.session.oauth2StateCreated;
  }
  
  next();
};

// Validate OAuth2 redirect URI
const validateRedirectURI = (req, res, next) => {
  const redirectURI = req.query.redirect_uri || req.body.redirect_uri;
  
  if (redirectURI) {
    const allowedURIs = config.hipaa.allowedRedirectURIs;
    
    if (!allowedURIs.includes(redirectURI)) {
      console.log('AUDIT: Invalid Redirect URI', {
        ip: req.ip,
        attemptedURI: redirectURI,
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'Invalid redirect URI',
        message: 'The redirect URI is not whitelisted'
      });
    }
  }
  
  next();
};

// Verify OAuth2 access token
const verifyOAuth2Token = async (req, res, next) => {
  try {
    // Get token from various sources
    let token = req.headers.authorization?.replace('Bearer ', '') ||
                req.query.access_token ||
                req.body.access_token;
    
    if (!token) {
      return res.status(401).json({
        error: 'No access token provided'
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-jwt-secret'
    );
    
    // Check if token is OAuth2 token
    if (decoded.authMethod !== 'oauth2') {
      return res.status(401).json({
        error: 'Invalid authentication method'
      });
    }
    
    // Add user info to request
    req.oauth2User = decoded;
    
    // HIPAA Audit Log for token usage
    if (config.hipaa.enableAuditLog) {
      console.log('AUDIT: OAuth2 Token Used', {
        userId: decoded.id,
        provider: decoded.provider,
        endpoint: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  } catch (error) {
    console.error('OAuth2 token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        expiredAt: error.expiredAt
      });
    }
    
    res.status(401).json({
      error: 'Invalid token'
    });
  }
};

// Check OAuth2 token expiration and auto-refresh if needed
const autoRefreshToken = async (req, res, next) => {
  try {
    if (!req.oauth2User) {
      return next();
    }
    
    const User = require('../../app/models/user.model');
    const user = await User.findById(req.oauth2User.id);
    
    if (!user || !user.oauth2Tokens) {
      return next();
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = new Date(user.oauth2Tokens.expiresAt);
    const now = new Date();
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 5 * 60 * 1000 && user.oauth2Tokens.refreshToken) {
      // Auto-refresh the token
      const oauth2Controller = require('../controllers/oauth2.controller');
      
      // Create mock request for refresh
      const refreshReq = {
        body: {
          provider: user.oauth2Provider,
          userId: user._id
        }
      };
      
      const refreshRes = {
        json: (data) => {
          if (data.success) {
            console.log('Auto-refreshed OAuth2 token for user:', user._id);
          }
        },
        status: () => refreshRes
      };
      
      // Attempt refresh in background
      oauth2Controller.refreshToken(refreshReq, refreshRes);
    }
    
    next();
  } catch (error) {
    console.error('Auto-refresh error:', error);
    next(); // Continue even if auto-refresh fails
  }
};

// Validate SMART on FHIR launch context
const validateSMARTContext = (req, res, next) => {
  const { iss, launch } = req.query;
  
  if (req.path.includes('/smart/')) {
    if (!iss) {
      return res.status(400).json({
        error: 'Missing ISS parameter',
        message: 'SMART on FHIR requires ISS parameter'
      });
    }
    
    // Validate ISS is a known FHIR server
    const knownServers = [
      'https://fhir.epic.com',
      'https://fhir.cerner.com',
      // Add more known FHIR servers
    ];
    
    const isKnownServer = knownServers.some(server => iss.startsWith(server));
    
    if (!isKnownServer && process.env.NODE_ENV === 'production') {
      console.log('AUDIT: Unknown FHIR Server', {
        iss: iss,
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'Unknown FHIR server',
        message: 'The ISS parameter does not match any known FHIR servers'
      });
    }
  }
  
  next();
};

// Log OAuth2 events for HIPAA compliance
const auditLogger = (eventType) => {
  return (req, res, next) => {
    if (config.hipaa.enableAuditLog) {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        event: eventType,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        method: req.method,
        provider: req.params.provider || 'unknown',
        userId: req.oauth2User?.id || 'anonymous'
      };
      
      // In production, write to audit log file
      console.log('AUDIT:', JSON.stringify(auditEntry));
      
      // Store audit entry in request for later use
      req.auditEntry = auditEntry;
    }
    
    next();
  };
};

// Sanitize OAuth2 response data
const sanitizeOAuth2Response = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Remove sensitive data from responses
    if (data && typeof data === 'object') {
      const sanitized = { ...data };
      
      // Never send these fields in responses
      delete sanitized.password;
      delete sanitized.oauth2Tokens?.refreshToken;
      delete sanitized.oauth2Tokens?.accessToken;
      
      // Mask partial sensitive data
      if (sanitized.email) {
        const [local, domain] = sanitized.email.split('@');
        sanitized.email = `${local.substring(0, 2)}***@${domain}`;
      }
      
      return originalJson.call(this, sanitized);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Enforce HTTPS in production
const enforceHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    console.log('AUDIT: Insecure OAuth2 Request', {
      ip: req.ip,
      endpoint: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({
      error: 'HTTPS required',
      message: 'OAuth2 endpoints must be accessed over HTTPS'
    });
  }
  
  next();
};

// Check user consent before sharing data
const checkDataConsent = async (req, res, next) => {
  try {
    if (!req.oauth2User) {
      return next();
    }
    
    const User = require('../../app/models/user.model');
    const user = await User.findById(req.oauth2User.id);
    
    if (!user) {
      return next();
    }
    
    const requiredConsents = ['dataSharing', 'thirdPartyAccess'];
    const userConsents = user.dataConsents || {};
    
    for (const consent of requiredConsents) {
      if (!userConsents[consent]) {
        return res.status(403).json({
          error: 'Consent required',
          message: `User has not consented to ${consent}`,
          requiredConsents: requiredConsents
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Consent check error:', error);
    next(); // Continue even if consent check fails
  }
};

module.exports = {
  oauth2RateLimiter,
  validateState,
  validateRedirectURI,
  verifyOAuth2Token,
  autoRefreshToken,
  validateSMARTContext,
  auditLogger,
  sanitizeOAuth2Response,
  enforceHTTPS,
  checkDataConsent
};