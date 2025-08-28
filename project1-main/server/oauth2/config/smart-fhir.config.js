// SMART on FHIR Configuration
// Configuration for major EHR systems and FHIR servers

module.exports = {
  // Epic (MyChart) Configuration
  epic: {
    // Epic's FHIR endpoints
    fhirBaseURL: process.env.EPIC_FHIR_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    authorizationURL: process.env.EPIC_AUTH_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenURL: process.env.EPIC_TOKEN_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    introspectionURL: process.env.EPIC_INTROSPECT_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/introspect',
    
    // Client credentials (must be registered with Epic)
    clientID: process.env.EPIC_CLIENT_ID || 'your-epic-client-id',
    clientSecret: process.env.EPIC_CLIENT_SECRET || 'your-epic-client-secret',
    callbackURL: process.env.EPIC_CALLBACK_URL || 'http://localhost:3000/auth/smart/epic/callback',
    
    // SMART scopes for Epic
    scope: 'patient/*.read launch openid fhirUser offline_access',
    
    // Epic-specific settings
    aud: process.env.EPIC_FHIR_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    
    // Response types
    responseType: 'code',
    responseMode: 'query'
  },

  // Cerner (PowerChart) Configuration
  cerner: {
    // Cerner's FHIR endpoints (tenant-specific)
    fhirBaseURL: process.env.CERNER_FHIR_URL || 'https://fhir-myrecord.cerner.com/r4/{tenant_id}',
    authorizationURL: process.env.CERNER_AUTH_URL || 'https://authorization.cerner.com/tenants/{tenant_id}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenURL: process.env.CERNER_TOKEN_URL || 'https://authorization.cerner.com/tenants/{tenant_id}/protocols/oauth2/profiles/smart-v1/token',
    
    // Client credentials
    clientID: process.env.CERNER_CLIENT_ID || 'your-cerner-client-id',
    clientSecret: process.env.CERNER_CLIENT_SECRET,
    callbackURL: process.env.CERNER_CALLBACK_URL || 'http://localhost:3000/auth/smart/cerner/callback',
    
    // SMART scopes for Cerner
    scope: 'patient/Patient.read patient/Condition.read patient/MedicationRequest.read patient/Observation.read launch online_access openid profile',
    
    // Cerner-specific settings
    tenantId: process.env.CERNER_TENANT_ID || 'your-tenant-id',
    aud: process.env.CERNER_FHIR_URL || 'https://fhir-myrecord.cerner.com/r4/{tenant_id}'
  },

  // Allscripts Configuration
  allscripts: {
    fhirBaseURL: process.env.ALLSCRIPTS_FHIR_URL || 'https://fhir.followmyhealth.com/fhir/api/r4',
    authorizationURL: process.env.ALLSCRIPTS_AUTH_URL || 'https://cloud.allscriptsunity.com/authorization/connect/authorize',
    tokenURL: process.env.ALLSCRIPTS_TOKEN_URL || 'https://cloud.allscriptsunity.com/authorization/connect/token',
    
    clientID: process.env.ALLSCRIPTS_CLIENT_ID || 'your-allscripts-client-id',
    clientSecret: process.env.ALLSCRIPTS_CLIENT_SECRET,
    callbackURL: process.env.ALLSCRIPTS_CALLBACK_URL || 'http://localhost:3000/auth/smart/allscripts/callback',
    
    scope: 'patient/*.read launch/patient openid profile offline_access',
    aud: process.env.ALLSCRIPTS_FHIR_URL
  },

  // Athenahealth Configuration
  athena: {
    fhirBaseURL: process.env.ATHENA_FHIR_URL || 'https://fhir.athenahealth.com/fhir-r4',
    authorizationURL: process.env.ATHENA_AUTH_URL || 'https://fhir.athenahealth.com/oauth2/authorize',
    tokenURL: process.env.ATHENA_TOKEN_URL || 'https://fhir.athenahealth.com/oauth2/token',
    
    clientID: process.env.ATHENA_CLIENT_ID || 'your-athena-client-id',
    clientSecret: process.env.ATHENA_CLIENT_SECRET,
    callbackURL: process.env.ATHENA_CALLBACK_URL || 'http://localhost:3000/auth/smart/athena/callback',
    
    scope: 'patient/*.read launch openid fhirUser',
    aud: process.env.ATHENA_FHIR_URL
  },

  // SMART Health IT Sandbox (for testing)
  sandbox: {
    fhirBaseURL: 'https://launch.smarthealthit.org/v/r4/fhir',
    authorizationURL: 'https://launch.smarthealthit.org/v/r4/auth/authorize',
    tokenURL: 'https://launch.smarthealthit.org/v/r4/auth/token',
    
    // Public client for sandbox (no secret needed)
    clientID: process.env.SANDBOX_CLIENT_ID || 'my_web_app',
    clientSecret: '', // Public client
    callbackURL: 'http://localhost:3000/auth/smart/sandbox/callback',
    
    scope: 'patient/*.read launch/patient openid profile',
    aud: 'https://launch.smarthealthit.org/v/r4/fhir',
    
    // Sandbox specific - can simulate different scenarios
    launch: process.env.SANDBOX_LAUNCH || 'eyJhIjoiMSJ9' // Base64 encoded launch context
  },

  // Common SMART on FHIR settings
  common: {
    // Token lifetimes (in seconds)
    accessTokenLifetime: 3600,  // 1 hour
    refreshTokenLifetime: 7200, // 2 hours
    
    // Security settings
    requireConfidentialClient: false, // Some EHRs support public clients
    usePKCE: true, // Use PKCE for additional security
    
    // Response handling
    allowedRedirectSchemes: ['http', 'https'], // In production, only 'https'
    stateParameterRequired: true,
    nonceParameterRequired: true,
    
    // FHIR version
    fhirVersion: 'R4', // Most EHRs use R4
    
    // Capabilities required from EHR
    requiredCapabilities: [
      'launch-ehr',      // EHR launch
      'launch-standalone', // Standalone launch
      'client-public',   // Public client support
      'client-confidential-symmetric', // Confidential client
      'sso-openid-connect', // OpenID Connect
      'context-patient', // Patient context
      'permission-patient', // Patient permissions
      'permission-offline' // Offline access
    ]
  },

  // Resource scopes mapping
  // Maps simplified scope names to FHIR resource scopes
  scopeMapping: {
    'demographics': 'patient/Patient.read',
    'medications': 'patient/MedicationRequest.read',
    'conditions': 'patient/Condition.read',
    'allergies': 'patient/AllergyIntolerance.read',
    'immunizations': 'patient/Immunization.read',
    'lab-results': 'patient/Observation.read patient/DiagnosticReport.read',
    'vitals': 'patient/Observation.read',
    'procedures': 'patient/Procedure.read',
    'documents': 'patient/DocumentReference.read',
    'appointments': 'patient/Appointment.read',
    'clinical-notes': 'patient/DocumentReference.read patient/DiagnosticReport.read',
    'all-read': 'patient/*.read',
    'all-write': 'patient/*.write'
  },

  // Error messages for common SMART errors
  errorMessages: {
    'invalid_scope': 'The requested permissions are not available',
    'invalid_client': 'This application is not registered with the EHR',
    'invalid_grant': 'The authorization code or refresh token is invalid',
    'unauthorized_client': 'This application is not authorized for this EHR',
    'access_denied': 'User denied access to their health records',
    'temporarily_unavailable': 'The EHR system is temporarily unavailable',
    'interaction_required': 'User interaction is required',
    'login_required': 'User must log in to the EHR system',
    'consent_required': 'User must provide consent for data access'
  },

  // Launch context parameters
  launchContextParams: {
    // Patient launch
    patient: {
      description: 'Patient in context',
      required: true,
      type: 'reference'
    },
    // Encounter launch
    encounter: {
      description: 'Encounter in context',
      required: false,
      type: 'reference'
    },
    // Practitioner launch
    practitioner: {
      description: 'Practitioner in context',
      required: false,
      type: 'reference'
    },
    // Need patient banner
    need_patient_banner: {
      description: 'App needs patient banner',
      required: false,
      type: 'boolean'
    },
    // Intent
    intent: {
      description: 'Launch intent',
      required: false,
      type: 'string'
    },
    // Smart style URL
    smart_style_url: {
      description: 'URL for SMART style',
      required: false,
      type: 'url'
    }
  }
};