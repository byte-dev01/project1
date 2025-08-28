// Google OAuth2 Strategy using Passport.js
// This handles authentication with Google accounts

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('../config/oauth2.config');

// Initialize Google OAuth2 Strategy
const initializeGoogleStrategy = (User) => {
  passport.use(new GoogleStrategy({
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackURL,
    scope: config.google.scope,
    accessType: config.google.accessType,
    prompt: config.google.prompt
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Log OAuth2 event for HIPAA compliance
      console.log(`OAuth2 Login Attempt - Provider: Google, ProfileID: ${profile.id}, Time: ${new Date().toISOString()}`);

      // Extract user information from Google profile
      const userData = {
        oauth2Provider: 'google',
        oauth2Id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        profilePicture: profile.photos[0]?.value,
        emailVerified: profile.emails[0].verified,
        // Store tokens securely (these should be encrypted before storing)
        oauth2Tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          provider: 'google',
          scope: config.google.scope.join(' '),
          expiresAt: new Date(Date.now() + 3600 * 1000) // Google tokens typically expire in 1 hour
        }
      };

      // Check if user already exists
      let user = await User.findOne({ 
        $or: [
          { email: userData.email },
          { oauth2Id: userData.oauth2Id, oauth2Provider: 'google' }
        ]
      });

      if (user) {
        // Update existing user with latest OAuth2 tokens
        user.oauth2Tokens = userData.oauth2Tokens;
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        
        // Update profile information if changed
        if (!user.profilePicture && userData.profilePicture) {
          user.profilePicture = userData.profilePicture;
        }
        
        await user.save();
        
        // Log successful login
        console.log(`OAuth2 Login Success - User: ${user._id}, Provider: Google`);
        
        return done(null, user);
      } else {
        // Create new user
        const newUser = new User({
          ...userData,
          // Set default role for new OAuth2 users
          roles: ['user'],
          accountStatus: 'active',
          createdAt: new Date(),
          lastLogin: new Date(),
          loginCount: 1,
          // Generate a random password for OAuth users (they won't use it)
          password: require('crypto').randomBytes(32).toString('hex'),
          // Mark as OAuth2 user
          authMethod: 'oauth2'
        });

        await newUser.save();
        
        // Log new user creation
        console.log(`OAuth2 New User Created - User: ${newUser._id}, Provider: Google`);
        
        return done(null, newUser);
      }
    } catch (error) {
      console.error('Google OAuth2 Strategy Error:', error);
      return done(error, null);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('-password -oauth2Tokens.refreshToken');
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

// Function to refresh Google OAuth2 token
const refreshGoogleToken = async (refreshToken) => {
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientID,
    config.google.clientSecret,
    config.google.callbackURL
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      accessToken: credentials.access_token,
      expiresAt: new Date(credentials.expiry_date)
    };
  } catch (error) {
    console.error('Failed to refresh Google token:', error);
    throw error;
  }
};

// Function to revoke Google OAuth2 token (for logout)
const revokeGoogleToken = async (accessToken) => {
  try {
    const response = await require('axios').post(
      `https://oauth2.googleapis.com/revoke?token=${accessToken}`
    );
    console.log('Google token revoked successfully');
    return true;
  } catch (error) {
    console.error('Failed to revoke Google token:', error);
    return false;
  }
};

module.exports = {
  initializeGoogleStrategy,
  refreshGoogleToken,
  revokeGoogleToken
};