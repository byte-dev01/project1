// SMART on FHIR OAuth2 Strategy
// Implements the SMART App Launch Framework for healthcare integrations
// Spec: https://docs.smarthealthit.org/

const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class SMARTStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    // SMART on FHIR specific options
    const smartOptions = {
      ...options,
      // SMART requires specific parameters
      authorizationURL: options.authorizationURL,
      tokenURL: options.tokenURL,
      scope: options.scope || 'patient/*.read launch openid fhirUser',
      state: true,
      // PKCE (Proof Key for Code Exchange) for additional security
      pkce: true,
      customHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    super(smartOptions, verify);
    
    this.name = 'smart-fhir';
    this.fhirBaseURL = options.fhirBaseURL;
    this.aud = options.aud || options.fhirBaseURL;
    
    // Store PKCE verifier for later use
    this.pkceVerifiers = new Map();
  }

  // Override authorizationParams to add SMART-specific parameters
  authorizationParams(options) {
    const params = super.authorizationParams(options);
    
    // Add SMART on FHIR specific parameters
    params.aud = this.aud;
    
    // Add launch context if provided
    if (options.launch) {
      params.launch = options.launch;
    }
    
    // Add PKCE challenge
    if (this._pkce) {
      const verifier = this.generatePKCEVerifier();
      const challenge = this.generatePKCEChallenge(verifier);
      
      // Store verifier for token exchange
      this.pkceVerifiers.set(params.state, verifier);
      
      params.code_challenge = challenge;
      params.code_challenge_method = 'S256';
    }
    
    return params;
  }

  // Generate PKCE verifier
  generatePKCEVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Generate PKCE challenge from verifier
  generatePKCEChallenge(verifier) {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  // Override getOAuthAccessToken to add PKCE verifier
  getOAuthAccessToken(code, params, callback) {
    const tokenParams = {
      ...params,
      grant_type: 'authorization_code',
      code: code
    };

    // Add PKCE verifier if available
    if (this._pkce && params.state) {
      const verifier = this.pkceVerifiers.get(params.state);
      if (verifier) {
        tokenParams.code_verifier = verifier;
        this.pkceVerifiers.delete(params.state);
      }
    }

    super.getOAuthAccessToken(code, tokenParams, callback);
  }
}

// Initialize SMART on FHIR strategy for a specific EHR
const initializeSMARTStrategy = (ehrName, config, User) => {
  const strategyName = `smart-${ehrName}`;
  
  passport.use(strategyName, new SMARTStrategy({
    authorizationURL: config.authorizationURL,
    tokenURL: config.tokenURL,
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    fhirBaseURL: config.fhirBaseURL,
    aud: config.aud,
    scope: config.scope,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, params, profile, done) => {
    try {
      console.log(`SMART on FHIR Login - EHR: ${ehrName}, Time: ${new Date().toISOString()}`);
      
      // Extract SMART context from token response
      const smartContext = {
        patient: params.patient,
        encounter: params.encounter,
        location: params.location,
        practitioner: params.practitioner,
        fhirUser: params.fhirUser,
        intent: params.intent,
        needPatientBanner: params.need_patient_banner,
        smartStyleUrl: params.smart_style_url
      };

      // Decode ID token if present (contains user information)
      let idTokenData = {};
      if (params.id_token) {
        try {
          // In production, verify the JWT signature
          idTokenData = jwt.decode(params.id_token);
        } catch (error) {
          console.error('Failed to decode ID token:', error);
        }
      }

      // Get patient demographics from FHIR API
      let patientData = null;
      if (smartContext.patient && accessToken) {
        try {
          patientData = await fetchPatientData(
            config.fhirBaseURL,
            smartContext.patient,
            accessToken
          );
        } catch (error) {
          console.error('Failed to fetch patient data:', error);
        }
      }

      // Build user data
      const userData = {
        oauth2Provider: `smart-${ehrName}`,
        oauth2Id: idTokenData.sub || smartContext.fhirUser || `${ehrName}_${Date.now()}`,
        email: idTokenData.email,
        name: idTokenData.name || patientData?.name,
        firstName: idTokenData.given_name || patientData?.firstName,
        lastName: idTokenData.family_name || patientData?.lastName,
        
        // FHIR-specific data
        fhirContext: {
          patient: smartContext.patient,
          encounter: smartContext.encounter,
          practitioner: smartContext.practitioner,
          fhirUser: smartContext.fhirUser,
          patientData: patientData
        },
        
        // Store tokens (should be encrypted)
        oauth2Tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          provider: `smart-${ehrName}`,
          scope: params.scope || config.scope,
          expiresAt: params.expires_in 
            ? new Date(Date.now() + params.expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000),
          tokenType: params.token_type || 'Bearer',
          smartContext: smartContext
        }
      };

      // Check if user exists
      let user = await User.findOne({ 
        $or: [
          { oauth2Id: userData.oauth2Id, oauth2Provider: userData.oauth2Provider },
          { 'fhirContext.patient': smartContext.patient }
        ]
      });

      if (user) {
        // Update existing user
        user.oauth2Tokens = userData.oauth2Tokens;
        user.fhirContext = userData.fhirContext;
        user.lastLogin = new Date();
        await user.save();
        
        console.log(`SMART Login Success - User: ${user._id}, EHR: ${ehrName}`);
        return done(null, user);
      } else {
        // Create new user
        const newUser = new User({
          ...userData,
          roles: ['patient'],
          accountStatus: 'active',
          createdAt: new Date(),
          lastLogin: new Date(),
          password: crypto.randomBytes(32).toString('hex'),
          authMethod: 'smart-fhir'
        });

        await newUser.save();
        console.log(`SMART New User Created - User: ${newUser._id}, EHR: ${ehrName}`);
        return done(null, newUser);
      }
    } catch (error) {
      console.error(`SMART ${ehrName} Strategy Error:`, error);
      return done(error, null);
    }
  }));

  return strategyName;
};

// Fetch patient data from FHIR server
async function fetchPatientData(fhirBaseURL, patientId, accessToken) {
  try {
    const response = await axios.get(
      `${fhirBaseURL}/Patient/${patientId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/fhir+json'
        }
      }
    );

    const patient = response.data;
    
    // Extract patient demographics
    const name = patient.name?.[0];
    const telecom = patient.telecom?.find(t => t.system === 'email');
    
    return {
      id: patient.id,
      firstName: name?.given?.join(' '),
      lastName: name?.family,
      name: name?.text,
      birthDate: patient.birthDate,
      gender: patient.gender,
      email: telecom?.value,
      phone: patient.telecom?.find(t => t.system === 'phone')?.value,
      address: patient.address?.[0],
      // Store full resource for later use
      fullResource: patient
    };
  } catch (error) {
    console.error('Error fetching patient data:', error);
    return null;
  }
}

// Fetch all patient resources (medications, conditions, etc.)
async function fetchPatientResources(fhirBaseURL, patientId, accessToken) {
  const resources = {};
  
  const resourceTypes = [
    'Condition',       // Medical conditions/diagnoses
    'MedicationRequest', // Current medications
    'Observation',     // Vitals, lab results
    'AllergyIntolerance', // Allergies
    'Immunization',    // Vaccination records
    'Procedure',       // Past procedures
    'DocumentReference' // Clinical documents
  ];

  for (const resourceType of resourceTypes) {
    try {
      const response = await axios.get(
        `${fhirBaseURL}/${resourceType}?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );
      
      resources[resourceType.toLowerCase()] = response.data.entry?.map(e => e.resource) || [];
    } catch (error) {
      console.error(`Error fetching ${resourceType}:`, error.message);
      resources[resourceType.toLowerCase()] = [];
    }
  }

  return resources;
}

// Get SMART configuration from EHR's well-known endpoint
async function discoverSMARTConfiguration(fhirBaseURL) {
  try {
    // Try SMART v2 endpoint first
    let configURL = `${fhirBaseURL}/.well-known/smart-configuration`;
    let response;
    
    try {
      response = await axios.get(configURL);
    } catch (error) {
      // Fall back to SMART v1 endpoint
      configURL = `${fhirBaseURL}/metadata`;
      response = await axios.get(configURL, {
        headers: { 'Accept': 'application/fhir+json' }
      });
      
      // Extract OAuth URLs from CapabilityStatement
      const security = response.data.rest?.[0]?.security;
      const oauth = security?.extension?.find(
        ext => ext.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
      );
      
      if (oauth) {
        const getExtensionValue = (url) => {
          const ext = oauth.extension?.find(e => e.url === url);
          return ext?.valueUri || ext?.valueString;
        };
        
        return {
          authorization_endpoint: getExtensionValue('authorize'),
          token_endpoint: getExtensionValue('token'),
          introspection_endpoint: getExtensionValue('introspect'),
          revocation_endpoint: getExtensionValue('revoke'),
          capabilities: security?.extension?.find(
            ext => ext.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/capabilities'
          )?.valueCode || []
        };
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to discover SMART configuration:', error);
    throw error;
  }
}

// Refresh SMART on FHIR token
async function refreshSMARTToken(config, refreshToken) {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientID
    });

    // Add client secret if not a public client
    if (config.clientSecret) {
      params.append('client_secret', config.clientSecret);
    }

    const response = await axios.post(config.tokenURL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in,
      scope: response.data.scope,
      patient: response.data.patient
    };
  } catch (error) {
    console.error('Failed to refresh SMART token:', error);
    throw error;
  }
}

// Validate SMART on FHIR token
async function validateSMARTToken(config, accessToken) {
  try {
    // Use introspection endpoint if available
    if (config.introspectionURL) {
      const params = new URLSearchParams({
        token: accessToken,
        client_id: config.clientID
      });

      if (config.clientSecret) {
        params.append('client_secret', config.clientSecret);
      }

      const response = await axios.post(config.introspectionURL, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      return response.data;
    }

    // Fallback: Try to use the token to fetch current user
    const response = await axios.get(`${config.fhirBaseURL}/Patient`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json'
      }
    });

    return { active: true };
  } catch (error) {
    return { active: false, error: error.message };
  }
}

module.exports = {
  SMARTStrategy,
  initializeSMARTStrategy,
  fetchPatientData,
  fetchPatientResources,
  discoverSMARTConfiguration,
  refreshSMARTToken,
  validateSMARTToken
};