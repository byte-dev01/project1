// OAuth2 Configuration File
// This file contains all OAuth2 provider configurations
// DO NOT commit actual client secrets to version control - use environment variables

module.exports = {
  // Google OAuth2 Configuration
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id-here',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret-here',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/oauth2/google/callback',
    scope: ['profile', 'email'],
    // Additional Google-specific settings
    accessType: 'offline', // Gets refresh token
    prompt: 'consent' // Forces consent screen to get refresh token
  },

  // Epic FHIR OAuth2 Configuration (for Epic MyChart integration)
  epic: {
    clientID: process.env.EPIC_CLIENT_ID || 'your-epic-client-id-here',
    clientSecret: process.env.EPIC_CLIENT_SECRET || 'your-epic-client-secret-here',
    authorizationURL: process.env.EPIC_AUTH_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenURL: process.env.EPIC_TOKEN_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    callbackURL: process.env.EPIC_CALLBACK_URL || 'http://localhost:3000/auth/oauth2/epic/callback',
    scope: 'patient/*.read launch/patient openid fhirUser',
    // SMART on FHIR specific
    aud: process.env.EPIC_FHIR_BASE_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4'
  },

  // Cerner FHIR OAuth2 Configuration
  cerner: {
    clientID: process.env.CERNER_CLIENT_ID || 'your-cerner-client-id-here',
    clientSecret: process.env.CERNER_CLIENT_SECRET || 'your-cerner-client-secret-here',
    authorizationURL: process.env.CERNER_AUTH_URL || 'https://authorization.cerner.com/tenants/tenant_id/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenURL: process.env.CERNER_TOKEN_URL || 'https://authorization.cerner.com/tenants/tenant_id/protocols/oauth2/profiles/smart-v1/token',
    callbackURL: process.env.CERNER_CALLBACK_URL || 'http://localhost:3000/auth/oauth2/cerner/callback',
    scope: 'patient/Patient.read patient/Observation.read launch online_access openid profile'
  },

  // Generic OAuth2 Provider Template
  generic: {
    clientID: process.env.OAUTH2_CLIENT_ID,
    clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    authorizationURL: process.env.OAUTH2_AUTH_URL,
    tokenURL: process.env.OAUTH2_TOKEN_URL,
    callbackURL: process.env.OAUTH2_CALLBACK_URL || 'http://localhost:3000/auth/oauth2/callback',
    scope: process.env.OAUTH2_SCOPE || 'openid profile email'
  },

  // Session configuration for OAuth2 state parameter
  session: {
    secret: process.env.OAUTH2_SESSION_SECRET || process.env.SESSION_SECRET || 'your-session-secret-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 15 // 15 minutes
    }
  },

  // Token storage encryption (for storing OAuth2 tokens)
  encryption: {
    algorithm: 'aes-256-gcm',
    secretKey: process.env.OAUTH2_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!', // Must be 32 bytes
    saltRounds: 10
  },

  // HIPAA Compliance Settings
  hipaa: {
    // Token expiration times (in seconds)
    accessTokenExpiry: 900, // 15 minutes
    refreshTokenExpiry: 7200, // 2 hours
    // Audit logging
    enableAuditLog: true,
    auditLogPath: process.env.AUDIT_LOG_PATH || './logs/oauth2-audit.log',
    // Security headers
    enableSecurityHeaders: true,
    // Token storage
    tokenStorageMethod: 'database', // Options: 'database', 'redis', 'memory'
    // Allowed redirect URIs (whitelist)
    allowedRedirectURIs: [
      'http://localhost:3000',
      'http://localhost:5000',
      // Add production URLs here
    ]
  },

  // Rate limiting for OAuth2 endpoints
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.'
  }
};