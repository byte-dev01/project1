// Generic OAuth2 Strategy
// This can be configured for any OAuth2 provider (Epic, Cerner, etc.)

const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const config = require('../config/oauth2.config');

// Initialize a generic OAuth2 Strategy
const initializeOAuth2Strategy = (providerName, providerConfig, User) => {
  const strategyName = `oauth2-${providerName}`;
  
  passport.use(strategyName, new OAuth2Strategy({
    authorizationURL: providerConfig.authorizationURL,
    tokenURL: providerConfig.tokenURL,
    clientID: providerConfig.clientID,
    clientSecret: providerConfig.clientSecret,
    callbackURL: providerConfig.callbackURL,
    scope: providerConfig.scope,
    state: true, // Enable state parameter for CSRF protection
    pkce: true, // Enable PKCE for additional security (if supported)
    passReqToCallback: true // Pass request to callback for additional context
  },
  async (req, accessToken, refreshToken, params, profile, done) => {
    try {
      // Log OAuth2 event for HIPAA compliance
      console.log(`OAuth2 Login Attempt - Provider: ${providerName}, Time: ${new Date().toISOString()}`);

      // For SMART on FHIR, the patient ID might be in the token response
      let patientId = params.patient || params.patient_id;
      
      // Some providers return user info in the token response
      let userInfo = {};
      
      // If provider supports OpenID Connect, decode the ID token
      if (params.id_token) {
        try {
          // In production, verify the JWT signature
          const idTokenPayload = JSON.parse(
            Buffer.from(params.id_token.split('.')[1], 'base64').toString()
          );
          userInfo = idTokenPayload;
        } catch (error) {
          console.error('Failed to decode ID token:', error);
        }
      }

      // Try to get user info from provider's userinfo endpoint if available
      if (providerConfig.userInfoURL) {
        try {
          const axios = require('axios');
          const response = await axios.get(providerConfig.userInfoURL, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          });
          userInfo = { ...userInfo, ...response.data };
        } catch (error) {
          console.error('Failed to fetch user info:', error);
        }
      }

      // Build user data from available information
      const userData = {
        oauth2Provider: providerName,
        oauth2Id: userInfo.sub || userInfo.id || profile?.id || `${providerName}_${Date.now()}`,
        email: userInfo.email || profile?.emails?.[0]?.value,
        name: userInfo.name || profile?.displayName,
        firstName: userInfo.given_name || profile?.name?.givenName,
        lastName: userInfo.family_name || profile?.name?.familyName,
        // Store healthcare-specific identifiers
        patientId: patientId,
        fhirResourceId: userInfo.fhirUser,
        // Store tokens securely (these should be encrypted before storing)
        oauth2Tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          provider: providerName,
          scope: providerConfig.scope,
          expiresAt: params.expires_in 
            ? new Date(Date.now() + params.expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000), // Default 1 hour
          tokenType: params.token_type || 'Bearer',
          // Store additional FHIR context if available
          patient: patientId,
          encounter: params.encounter,
          location: params.location,
          // Store the full params for debugging/future use
          rawParams: params
        }
      };

      // Check if user already exists
      let user = await User.findOne({ 
        $or: [
          { oauth2Id: userData.oauth2Id, oauth2Provider: providerName },
          { email: userData.email } // Only match by email if it exists
        ].filter(condition => condition.email !== undefined)
      });

      if (user) {
        // Update existing user with latest OAuth2 tokens
        user.oauth2Tokens = userData.oauth2Tokens;
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        
        // Update healthcare identifiers if available
        if (userData.patientId) user.patientId = userData.patientId;
        if (userData.fhirResourceId) user.fhirResourceId = userData.fhirResourceId;
        
        await user.save();
        
        console.log(`OAuth2 Login Success - User: ${user._id}, Provider: ${providerName}`);
        
        return done(null, user);
      } else {
        // Create new user
        const newUser = new User({
          ...userData,
          // Set default role for new OAuth2 users
          roles: ['patient'], // Default role for healthcare OAuth2 users
          accountStatus: 'active',
          createdAt: new Date(),
          lastLogin: new Date(),
          loginCount: 1,
          // Generate a random password for OAuth users (they won't use it)
          password: require('crypto').randomBytes(32).toString('hex'),
          // Mark as OAuth2 user
          authMethod: 'oauth2',
          // Store provider-specific metadata
          providerMetadata: {
            provider: providerName,
            originalProfile: profile || userInfo
          }
        });

        await newUser.save();
        
        console.log(`OAuth2 New User Created - User: ${newUser._id}, Provider: ${providerName}`);
        
        return done(null, newUser);
      }
    } catch (error) {
      console.error(`${providerName} OAuth2 Strategy Error:`, error);
      return done(error, null);
    }
  }));

  return strategyName;
};

// SMART on FHIR specific strategy initialization
const initializeSMARTStrategy = (providerName, providerConfig, User) => {
  // SMART on FHIR has specific requirements
  const smartConfig = {
    ...providerConfig,
    // Add SMART-specific parameters
    authorizationParams: {
      aud: providerConfig.aud, // FHIR server URL
      launch: providerConfig.launch, // Launch context (if applicable)
    }
  };

  return initializeOAuth2Strategy(providerName, smartConfig, User);
};

// Function to refresh OAuth2 token
const refreshOAuth2Token = async (providerConfig, refreshToken) => {
  const axios = require('axios');
  
  try {
    const response = await axios.post(providerConfig.tokenURL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: providerConfig.clientID,
      client_secret: providerConfig.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt: response.data.expires_in 
        ? new Date(Date.now() + response.data.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000)
    };
  } catch (error) {
    console.error('Failed to refresh OAuth2 token:', error);
    throw error;
  }
};

// Function to revoke OAuth2 token
const revokeOAuth2Token = async (providerConfig, accessToken) => {
  if (!providerConfig.revokeURL) {
    console.log('No revoke URL configured for this provider');
    return false;
  }

  const axios = require('axios');
  
  try {
    await axios.post(providerConfig.revokeURL, {
      token: accessToken,
      client_id: providerConfig.clientID,
      client_secret: providerConfig.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('OAuth2 token revoked successfully');
    return true;
  } catch (error) {
    console.error('Failed to revoke OAuth2 token:', error);
    return false;
  }
};

module.exports = {
  initializeOAuth2Strategy,
  initializeSMARTStrategy,
  refreshOAuth2Token,
  revokeOAuth2Token
};