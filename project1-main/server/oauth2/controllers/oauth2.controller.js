// OAuth2 Controller
// Handles OAuth2 authentication logic and token management

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/oauth2.config');
const { refreshGoogleToken, revokeGoogleToken } = require('../strategies/googleStrategy');
const { refreshOAuth2Token, revokeOAuth2Token } = require('../strategies/genericStrategy');

// Encryption helper for storing tokens
const encryptToken = (token) => {
  const algorithm = config.encryption.algorithm;
  const key = Buffer.from(config.encryption.secretKey, 'utf8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

const decryptToken = (encryptedData) => {
  const algorithm = config.encryption.algorithm;
  const key = Buffer.from(config.encryption.secretKey, 'utf8');
  const decipher = crypto.createDecipheriv(
    algorithm, 
    key, 
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Generate JWT token for authenticated user
const generateJWT = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    roles: user.roles,
    authMethod: 'oauth2',
    provider: user.oauth2Provider
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: config.hipaa.accessTokenExpiry }
  );
};

// Controller methods
const oauth2Controller = {
  // Handle Google OAuth2 callback
  handleGoogleCallback: async (req, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.redirect('/login?error=no_user');
      }
      
      // Encrypt and store tokens
      if (user.oauth2Tokens?.accessToken) {
        user.oauth2Tokens.accessToken = encryptToken(user.oauth2Tokens.accessToken);
      }
      if (user.oauth2Tokens?.refreshToken) {
        user.oauth2Tokens.refreshToken = encryptToken(user.oauth2Tokens.refreshToken);
      }
      await user.save();
      
      // Generate JWT for session
      const token = generateJWT(user);
      
      // HIPAA Audit Log
      console.log('AUDIT: OAuth2 Login Success', {
        userId: user._id,
        provider: 'google',
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      // Redirect with token (in production, use secure cookie instead)
      res.redirect(`/dashboard?token=${token}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/login?error=callback_failed');
    }
  },
  
  // Handle generic OAuth2 callback
  handleOAuth2Callback: async (req, res) => {
    try {
      const user = req.user;
      const provider = req.params.provider;
      
      if (!user) {
        return res.redirect('/login?error=no_user');
      }
      
      // Encrypt and store tokens
      if (user.oauth2Tokens?.accessToken) {
        user.oauth2Tokens.accessToken = encryptToken(user.oauth2Tokens.accessToken);
      }
      if (user.oauth2Tokens?.refreshToken) {
        user.oauth2Tokens.refreshToken = encryptToken(user.oauth2Tokens.refreshToken);
      }
      await user.save();
      
      // Generate JWT for session
      const token = generateJWT(user);
      
      // HIPAA Audit Log
      console.log('AUDIT: OAuth2 Login Success', {
        userId: user._id,
        provider: provider,
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      // For SMART on FHIR, redirect to ready endpoint
      if (provider === 'epic' || provider === 'cerner') {
        res.redirect(`/auth/oauth2/smart/ready?token=${token}`);
      } else {
        res.redirect(`/dashboard?token=${token}`);
      }
    } catch (error) {
      console.error('OAuth2 callback error:', error);
      res.redirect('/login?error=callback_failed');
    }
  },
  
  // Handle SMART on FHIR launch
  handleSMARTLaunch: async (req, res) => {
    try {
      const { iss, launch } = req.query;
      
      if (!iss || !launch) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Store launch context in session
      req.session.smartContext = {
        iss,
        launch,
        timestamp: new Date().toISOString()
      };
      
      // Determine provider based on ISS
      let provider = 'epic'; // Default
      if (iss.includes('cerner')) provider = 'cerner';
      
      // Redirect to OAuth2 authorization
      res.redirect(`/auth/oauth2/${provider}?launch=${launch}`);
    } catch (error) {
      console.error('SMART launch error:', error);
      res.status(500).json({ error: 'Launch failed' });
    }
  },
  
  // Handle SMART on FHIR ready
  handleSMARTReady: async (req, res) => {
    try {
      const { token } = req.query;
      
      // In production, this would render a page that posts the token
      // to the parent window (if in an iframe) or sets it as a cookie
      res.send(`
        <html>
          <body>
            <script>
              // Post message to parent window if in iframe
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: 'smart-ready',
                  token: '${token}'
                }, '*');
              } else {
                // Store token and redirect to app
                localStorage.setItem('authToken', '${token}');
                window.location.href = '/dashboard';
              }
            </script>
            <p>Authorization successful. Redirecting...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('SMART ready error:', error);
      res.status(500).json({ error: 'Ready failed' });
    }
  },
  
  // Refresh OAuth2 token
  refreshToken: async (req, res) => {
    try {
      const { provider, userId } = req.body;
      
      // Get user and decrypt refresh token
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user || !user.oauth2Tokens?.refreshToken) {
        return res.status(400).json({ error: 'No refresh token available' });
      }
      
      const refreshToken = decryptToken(user.oauth2Tokens.refreshToken);
      
      let newTokens;
      if (provider === 'google') {
        newTokens = await refreshGoogleToken(refreshToken);
      } else {
        const providerConfig = config[provider];
        newTokens = await refreshOAuth2Token(providerConfig, refreshToken);
      }
      
      // Update user with new tokens
      user.oauth2Tokens.accessToken = encryptToken(newTokens.accessToken);
      user.oauth2Tokens.expiresAt = newTokens.expiresAt;
      await user.save();
      
      // HIPAA Audit Log
      console.log('AUDIT: Token Refreshed', {
        userId: user._id,
        provider: provider,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true, expiresAt: newTokens.expiresAt });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  },
  
  // Revoke OAuth2 token
  revokeToken: async (req, res) => {
    try {
      const { provider, userId } = req.body;
      
      // Get user and decrypt access token
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user || !user.oauth2Tokens?.accessToken) {
        return res.status(400).json({ error: 'No token to revoke' });
      }
      
      const accessToken = decryptToken(user.oauth2Tokens.accessToken);
      
      let revoked;
      if (provider === 'google') {
        revoked = await revokeGoogleToken(accessToken);
      } else {
        const providerConfig = config[provider];
        revoked = await revokeOAuth2Token(providerConfig, accessToken);
      }
      
      // Clear tokens from user
      user.oauth2Tokens = undefined;
      await user.save();
      
      // HIPAA Audit Log
      console.log('AUDIT: Token Revoked', {
        userId: user._id,
        provider: provider,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: revoked });
    } catch (error) {
      console.error('Token revoke error:', error);
      res.status(500).json({ error: 'Failed to revoke token' });
    }
  },
  
  // Get token info (for debugging)
  getTokenInfo: async (req, res) => {
    try {
      const { userId } = req.query;
      
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user || !user.oauth2Tokens) {
        return res.status(404).json({ error: 'No OAuth2 tokens found' });
      }
      
      // Don't send actual tokens, just metadata
      const tokenInfo = {
        provider: user.oauth2Tokens.provider,
        scope: user.oauth2Tokens.scope,
        expiresAt: user.oauth2Tokens.expiresAt,
        hasRefreshToken: !!user.oauth2Tokens.refreshToken,
        tokenType: user.oauth2Tokens.tokenType
      };
      
      res.json(tokenInfo);
    } catch (error) {
      console.error('Get token info error:', error);
      res.status(500).json({ error: 'Failed to get token info' });
    }
  },
  
  // Link OAuth2 provider to existing account
  linkAccount: async (req, res) => {
    try {
      const { provider } = req.params;
      const { userId } = req.body;
      
      // Store linking intent in session
      req.session.linkingUserId = userId;
      req.session.linkingProvider = provider;
      
      // Redirect to OAuth2 flow
      res.redirect(`/auth/oauth2/${provider}`);
    } catch (error) {
      console.error('Link account error:', error);
      res.status(500).json({ error: 'Failed to link account' });
    }
  },
  
  // Unlink OAuth2 provider from account
  unlinkAccount: async (req, res) => {
    try {
      const { provider } = req.params;
      const { userId } = req.body;
      
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Clear OAuth2 data for this provider
      if (user.oauth2Provider === provider) {
        user.oauth2Provider = undefined;
        user.oauth2Id = undefined;
        user.oauth2Tokens = undefined;
      }
      
      await user.save();
      
      // HIPAA Audit Log
      console.log('AUDIT: Provider Unlinked', {
        userId: user._id,
        provider: provider,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Unlink account error:', error);
      res.status(500).json({ error: 'Failed to unlink account' });
    }
  },
  
  // Get linked OAuth2 providers
  getLinkedProviders: async (req, res) => {
    try {
      const { userId } = req.query;
      
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const linkedProviders = [];
      if (user.oauth2Provider) {
        linkedProviders.push({
          provider: user.oauth2Provider,
          linkedAt: user.createdAt,
          hasTokens: !!user.oauth2Tokens
        });
      }
      
      res.json({ linkedProviders });
    } catch (error) {
      console.error('Get linked providers error:', error);
      res.status(500).json({ error: 'Failed to get linked providers' });
    }
  },
  
  // Get user audit log (HIPAA requirement)
  getUserAuditLog: async (req, res) => {
    try {
      const { userId, startDate, endDate } = req.query;
      
      // In production, this would query an audit log database
      // For now, return mock data
      const auditLog = [
        {
          timestamp: new Date().toISOString(),
          event: 'oauth2_login',
          provider: 'google',
          ip: req.ip,
          success: true
        }
      ];
      
      res.json({ auditLog });
    } catch (error) {
      console.error('Get audit log error:', error);
      res.status(500).json({ error: 'Failed to get audit log' });
    }
  },
  
  // Update consent for data sharing
  updateConsent: async (req, res) => {
    try {
      const { userId, consents } = req.body;
      
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      user.dataConsents = {
        ...user.dataConsents,
        ...consents,
        lastUpdated: new Date()
      };
      
      await user.save();
      
      // HIPAA Audit Log
      console.log('AUDIT: Consent Updated', {
        userId: user._id,
        consents: consents,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Update consent error:', error);
      res.status(500).json({ error: 'Failed to update consent' });
    }
  },
  
  // Get current consent settings
  getConsent: async (req, res) => {
    try {
      const { userId } = req.query;
      
      const User = require('../../app/models/user.model');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ consents: user.dataConsents || {} });
    } catch (error) {
      console.error('Get consent error:', error);
      res.status(500).json({ error: 'Failed to get consent' });
    }
  },
  
  // Test configuration (development only)
  testConfiguration: async (req, res) => {
    const providers = ['google', 'epic', 'cerner', 'generic'];
    const configStatus = {};
    
    providers.forEach(provider => {
      const providerConfig = config[provider];
      configStatus[provider] = {
        hasClientId: !!providerConfig?.clientID && providerConfig.clientID !== `your-${provider}-client-id-here`,
        hasClientSecret: !!providerConfig?.clientSecret && providerConfig.clientSecret !== `your-${provider}-client-secret-here`,
        callbackURL: providerConfig?.callbackURL
      };
    });
    
    res.json({ configStatus });
  },
  
  // Mock OAuth2 login (development only)
  mockOAuth2Login: async (req, res) => {
    const mockUser = {
      _id: 'mock_user_id',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['patient'],
      oauth2Provider: 'mock',
      oauth2Id: 'mock_oauth_id'
    };
    
    const token = generateJWT(mockUser);
    
    res.json({
      success: true,
      token,
      user: mockUser
    });
  }
};

module.exports = oauth2Controller;