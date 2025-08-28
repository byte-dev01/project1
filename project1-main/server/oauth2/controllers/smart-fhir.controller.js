// SMART on FHIR Controller
// Handles SMART App Launch and FHIR API interactions

const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const smartConfig = require('../config/smart-fhir.config');
const { 
  fetchPatientData, 
  fetchPatientResources,
  discoverSMARTConfiguration,
  refreshSMARTToken,
  validateSMARTToken
} = require('../strategies/smartFhirStrategy');

// Store launch contexts (in production, use Redis or database)
const launchContexts = new Map();

const smartController = {
  // Handle SMART launch from EHR
  handleLaunch: async (req, res) => {
    try {
      const { iss, launch } = req.query;
      
      if (!iss) {
        return res.status(400).json({ 
          error: 'Missing ISS parameter',
          message: 'The EHR server URL (iss) is required'
        });
      }

      // Determine which EHR based on ISS
      let ehrName = 'unknown';
      if (iss.includes('epic')) ehrName = 'epic';
      else if (iss.includes('cerner')) ehrName = 'cerner';
      else if (iss.includes('allscripts')) ehrName = 'allscripts';
      else if (iss.includes('athena')) ehrName = 'athena';
      else if (iss.includes('smarthealthit')) ehrName = 'sandbox';

      // Get EHR configuration
      const ehrConfig = smartConfig[ehrName];
      if (!ehrConfig) {
        return res.status(400).json({
          error: 'Unknown EHR',
          message: `EHR ${ehrName} is not configured`
        });
      }

      // Discover SMART endpoints if not configured
      let authorizationURL = ehrConfig.authorizationURL;
      let tokenURL = ehrConfig.tokenURL;

      if (!authorizationURL || authorizationURL.includes('{')) {
        try {
          const smartEndpoints = await discoverSMARTConfiguration(iss);
          authorizationURL = smartEndpoints.authorization_endpoint;
          tokenURL = smartEndpoints.token_endpoint;
        } catch (error) {
          console.error('Failed to discover SMART endpoints:', error);
        }
      }

      // Generate state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      
      // Store launch context
      launchContexts.set(state, {
        iss,
        launch,
        ehrName,
        timestamp: Date.now()
      });

      // Build authorization URL
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: ehrConfig.clientID,
        redirect_uri: ehrConfig.callbackURL,
        scope: ehrConfig.scope,
        state: state,
        aud: iss
      });

      // Add launch parameter if provided (EHR launch)
      if (launch) {
        params.append('launch', launch);
      }

      // Add PKCE challenge if configured
      if (smartConfig.common.usePKCE) {
        const verifier = crypto.randomBytes(32).toString('base64url');
        const challenge = crypto
          .createHash('sha256')
          .update(verifier)
          .digest('base64url');
        
        launchContexts.get(state).pkceVerifier = verifier;
        params.append('code_challenge', challenge);
        params.append('code_challenge_method', 'S256');
      }

      const authURL = `${authorizationURL}?${params.toString()}`;
      
      console.log('SMART Launch:', {
        ehr: ehrName,
        iss,
        hasLaunch: !!launch,
        state
      });

      // Redirect to EHR authorization
      res.redirect(authURL);
    } catch (error) {
      console.error('SMART launch error:', error);
      res.status(500).json({
        error: 'Launch failed',
        message: error.message
      });
    }
  },

  // Handle callback from EHR after authorization
  handleCallback: async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      const ehrName = req.params.ehr;

      // Check for authorization errors
      if (error) {
        return res.status(400).json({
          error: error,
          message: error_description || smartConfig.errorMessages[error] || 'Authorization failed'
        });
      }

      // Validate state
      const launchContext = launchContexts.get(state);
      if (!launchContext) {
        return res.status(403).json({
          error: 'Invalid state',
          message: 'Security validation failed'
        });
      }

      // Clean up old launch contexts (older than 10 minutes)
      for (const [key, context] of launchContexts.entries()) {
        if (Date.now() - context.timestamp > 600000) {
          launchContexts.delete(key);
        }
      }

      const ehrConfig = smartConfig[ehrName];
      
      // Exchange authorization code for tokens
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ehrConfig.callbackURL,
        client_id: ehrConfig.clientID
      });

      // Add client secret if configured (confidential client)
      if (ehrConfig.clientSecret) {
        tokenParams.append('client_secret', ehrConfig.clientSecret);
      }

      // Add PKCE verifier if used
      if (launchContext.pkceVerifier) {
        tokenParams.append('code_verifier', launchContext.pkceVerifier);
      }

      const tokenResponse = await axios.post(ehrConfig.tokenURL, tokenParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      const tokens = tokenResponse.data;
      
      // Extract SMART context from token response
      const smartContext = {
        patient: tokens.patient,
        encounter: tokens.encounter,
        practitioner: tokens.practitioner,
        need_patient_banner: tokens.need_patient_banner,
        smart_style_url: tokens.smart_style_url,
        intent: tokens.intent,
        fhirUser: tokens.fhirUser,
        tenant: tokens.tenant
      };

      // Decode ID token if present
      let userInfo = {};
      if (tokens.id_token) {
        try {
          userInfo = jwt.decode(tokens.id_token);
        } catch (error) {
          console.error('Failed to decode ID token:', error);
        }
      }

      // Get patient data if patient context exists
      let patientData = null;
      if (smartContext.patient) {
        try {
          patientData = await fetchPatientData(
            launchContext.iss,
            smartContext.patient,
            tokens.access_token
          );
        } catch (error) {
          console.error('Failed to fetch patient data:', error);
        }
      }

      // Create session data
      const sessionData = {
        ehr: ehrName,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
          scope: tokens.scope
        },
        smartContext,
        userInfo,
        patientData,
        fhirBaseURL: launchContext.iss
      };

      // Store session (in production, use secure session storage)
      const sessionId = crypto.randomBytes(32).toString('hex');
      req.session.smartSession = sessionData;
      req.session.smartSessionId = sessionId;

      // Clean up launch context
      launchContexts.delete(state);

      // Redirect to app with session info
      res.redirect(`/dashboard?session=${sessionId}&patient=${smartContext.patient || ''}`);
    } catch (error) {
      console.error('SMART callback error:', error);
      res.status(500).json({
        error: 'Callback failed',
        message: error.message
      });
    }
  },

  // Initiate standalone launch (without EHR context)
  initiateStandaloneLaunch: async (req, res) => {
    try {
      const ehrName = req.params.ehr;
      const ehrConfig = smartConfig[ehrName];
      
      if (!ehrConfig) {
        return res.status(400).json({
          error: 'Unknown EHR',
          message: `EHR ${ehrName} is not configured`
        });
      }

      // For standalone launch, we don't have a launch parameter
      // User will select patient after authorization
      const state = crypto.randomBytes(32).toString('hex');
      
      // Store context
      launchContexts.set(state, {
        iss: ehrConfig.fhirBaseURL,
        ehrName,
        standalone: true,
        timestamp: Date.now()
      });

      // Build authorization URL without launch parameter
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: ehrConfig.clientID,
        redirect_uri: ehrConfig.callbackURL,
        scope: ehrConfig.scope.replace('launch', 'launch/patient'), // Request patient selection
        state: state,
        aud: ehrConfig.fhirBaseURL
      });

      const authURL = `${ehrConfig.authorizationURL}?${params.toString()}`;
      res.redirect(authURL);
    } catch (error) {
      console.error('Standalone launch error:', error);
      res.status(500).json({
        error: 'Launch failed',
        message: error.message
      });
    }
  },

  // Verify access token middleware
  verifyAccessToken: async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          error: 'No access token',
          message: 'Authorization header with Bearer token required'
        });
      }

      // Get session
      const session = req.session.smartSession;
      if (!session || session.tokens.access_token !== token) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Token not recognized'
        });
      }

      // Check if token expired
      if (Date.now() > session.tokens.expires_at) {
        // Try to refresh
        if (session.tokens.refresh_token) {
          try {
            const ehrConfig = smartConfig[session.ehr];
            const newTokens = await refreshSMARTToken(
              ehrConfig,
              session.tokens.refresh_token
            );
            
            session.tokens.access_token = newTokens.accessToken;
            session.tokens.refresh_token = newTokens.refreshToken || session.tokens.refresh_token;
            session.tokens.expires_at = Date.now() + (newTokens.expiresIn * 1000);
            
            req.smartToken = newTokens.accessToken;
          } catch (error) {
            return res.status(401).json({
              error: 'Token expired',
              message: 'Failed to refresh token'
            });
          }
        } else {
          return res.status(401).json({
            error: 'Token expired',
            message: 'Please re-authenticate'
          });
        }
      } else {
        req.smartToken = token;
      }

      req.smartSession = session;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        error: 'Invalid token',
        message: error.message
      });
    }
  },

  // Get patient data
  getPatient: async (req, res) => {
    try {
      const { id } = req.params;
      const { smartSession, smartToken } = req;
      
      const response = await axios.get(
        `${smartSession.fhirBaseURL}/Patient/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${smartToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error('Error fetching patient:', error);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch patient',
        message: error.message
      });
    }
  },

  // Get patient conditions
  getConditions: async (req, res) => {
    try {
      const { smartSession, smartToken } = req;
      const patient = req.query.patient || smartSession.smartContext.patient;
      
      if (!patient) {
        return res.status(400).json({
          error: 'No patient context',
          message: 'Patient ID required'
        });
      }

      const response = await axios.get(
        `${smartSession.fhirBaseURL}/Condition?patient=${patient}`,
        {
          headers: {
            'Authorization': `Bearer ${smartToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error('Error fetching conditions:', error);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch conditions',
        message: error.message
      });
    }
  },

  // Get patient medications
  getMedications: async (req, res) => {
    try {
      const { smartSession, smartToken } = req;
      const patient = req.query.patient || smartSession.smartContext.patient;
      
      const response = await axios.get(
        `${smartSession.fhirBaseURL}/MedicationRequest?patient=${patient}`,
        {
          headers: {
            'Authorization': `Bearer ${smartToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error('Error fetching medications:', error);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch medications',
        message: error.message
      });
    }
  },

  // Get patient observations (vitals, labs)
  getObservations: async (req, res) => {
    try {
      const { smartSession, smartToken } = req;
      const patient = req.query.patient || smartSession.smartContext.patient;
      const category = req.query.category; // vital-signs, laboratory, etc.
      
      let url = `${smartSession.fhirBaseURL}/Observation?patient=${patient}`;
      if (category) {
        url += `&category=${category}`;
      }

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${smartToken}`,
          'Accept': 'application/fhir+json'
        }
      });

      res.json(response.data);
    } catch (error) {
      console.error('Error fetching observations:', error);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch observations',
        message: error.message
      });
    }
  },

  // Get patient allergies
  getAllergies: async (req, res) => {
    try {
      const { smartSession, smartToken } = req;
      const patient = req.query.patient || smartSession.smartContext.patient;
      
      const response = await axios.get(
        `${smartSession.fhirBaseURL}/AllergyIntolerance?patient=${patient}`,
        {
          headers: {
            'Authorization': `Bearer ${smartToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error('Error fetching allergies:', error);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch allergies',
        message: error.message
      });
    }
  },

  // Get patient immunizations
  getImmunizations: async (req, res) => {
    try {
      const { smartSession, smartToken } = req;
      const patient = req.query.patient || smartSession.smartContext.patient;
      
      const response = await axios.get(
        `${smartSession.fhirBaseURL}/Immunization?patient=${patient}`,
        {
          headers: {
            'Authorization': `Bearer ${smartToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error('Error fetching immunizations:', error);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch immunizations',
        message: error.message
      });
    }
  },

  // Generic FHIR resource endpoint
  getFHIRResource: async (req, res) => {
    try {
      const { resourceType } = req.params;
      const { smartSession, smartToken } = req;
      
      // Build query string from request query params
      const queryString = new URLSearchParams(req.query).toString();
      const url = `${smartSession.fhirBaseURL}/${resourceType}${queryString ? '?' + queryString : ''}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${smartToken}`,
          'Accept': 'application/fhir+json'
        }
      });

      res.json(response.data);
    } catch (error) {
      console.error(`Error fetching ${req.params.resourceType}:`, error);
      res.status(error.response?.status || 500).json({
        error: `Failed to fetch ${req.params.resourceType}`,
        message: error.message
      });
    }
  },

  // Additional controller methods...
  refreshToken: async (req, res) => {
    // Implementation for token refresh
    res.json({ message: 'Token refresh endpoint' });
  },

  introspectToken: async (req, res) => {
    // Implementation for token introspection
    res.json({ message: 'Token introspection endpoint' });
  },

  getPatientContext: async (req, res) => {
    // Get current patient context
    const { smartSession } = req;
    res.json({
      patient: smartSession.smartContext.patient,
      patientData: smartSession.patientData
    });
  },

  // Test endpoints
  testConfiguration: async (req, res) => {
    const configs = {};
    for (const [ehr, config] of Object.entries(smartConfig)) {
      if (ehr !== 'common' && ehr !== 'scopeMapping' && ehr !== 'errorMessages' && ehr !== 'launchContextParams') {
        configs[ehr] = {
          configured: !!config.clientID && !config.clientID.includes('your-'),
          fhirURL: config.fhirBaseURL
        };
      }
    }
    res.json({ configurations: configs });
  }
};

module.exports = smartController;