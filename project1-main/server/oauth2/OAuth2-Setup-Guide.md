# OAuth2 Setup Guide

This guide explains how to integrate and use the OAuth2 authentication system in your medical app.

## Overview

OAuth2 is an authorization framework that enables applications to obtain limited access to user accounts. This implementation supports:

- **Google OAuth2** for general user authentication
- **Epic/Cerner FHIR** for healthcare system integration
- **Generic OAuth2** for any OAuth2-compliant provider
- **HIPAA compliance** features including audit logging and encryption

## File Structure

```
server/oauth2/
├── config/
│   └── oauth2.config.js         # Configuration for all OAuth2 providers
├── strategies/
│   ├── googleStrategy.js        # Google OAuth2 implementation
│   └── genericStrategy.js       # Generic/SMART on FHIR implementation
├── routes/
│   └── oauth2.routes.js         # All OAuth2 endpoints
├── controllers/
│   └── oauth2.controller.js     # Business logic for OAuth2
├── middleware/
│   └── oauth2.middleware.js     # Security and validation middleware
└── OAuth2-Setup-Guide.md        # This file
```

## How OAuth2 Works

1. **User clicks "Login with Google"** → Redirects to Google
2. **User authorizes your app** → Google redirects back with a code
3. **Your app exchanges code for tokens** → Gets access token & refresh token
4. **Use access token for API calls** → Access user data from provider
5. **Refresh token when expired** → Get new access token without re-login

## Integration Steps

### Step 1: Install Required Packages

```bash
npm install passport passport-google-oauth20 passport-oauth2 googleapis
```

### Step 2: Set Environment Variables

Add to your `.env` file:

```env
# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/oauth2/google/callback

# Epic FHIR (if using)
EPIC_CLIENT_ID=your-epic-client-id
EPIC_CLIENT_SECRET=your-epic-client-secret
EPIC_AUTH_URL=https://fhir.epic.com/oauth2/authorize
EPIC_TOKEN_URL=https://fhir.epic.com/oauth2/token
EPIC_CALLBACK_URL=http://localhost:3000/auth/oauth2/epic/callback

# Security
OAUTH2_SESSION_SECRET=your-session-secret-here
OAUTH2_ENCRYPTION_KEY=your-32-byte-encryption-key-here
JWT_SECRET=your-jwt-secret-here
```

### Step 3: Update User Model

Add OAuth2 fields to your user model (`server/app/models/user.model.js`):

```javascript
// Add these fields to your user schema
oauth2Provider: String,
oauth2Id: String,
authMethod: {
  type: String,
  enum: ['local', 'oauth2'],
  default: 'local'
},
oauth2Tokens: {
  accessToken: Object,  // Encrypted
  refreshToken: Object, // Encrypted
  provider: String,
  scope: String,
  expiresAt: Date,
  tokenType: String
},
dataConsents: {
  dataSharing: Boolean,
  thirdPartyAccess: Boolean,
  lastUpdated: Date
},
patientId: String,        // For FHIR integration
fhirResourceId: String    // For FHIR integration
```

### Step 4: Initialize OAuth2 in Your Server

Add to your `server/server.js`:

```javascript
// Import OAuth2 components
const passport = require('passport');
const oauth2Routes = require('./oauth2/routes/oauth2.routes');
const { initializeGoogleStrategy } = require('./oauth2/strategies/googleStrategy');
const { initializeOAuth2Strategy } = require('./oauth2/strategies/genericStrategy');

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Initialize strategies (pass your User model)
const User = require('./app/models/user.model');
initializeGoogleStrategy(User);

// Initialize other providers as needed
// initializeOAuth2Strategy('epic', epicConfig, User);

// Mount OAuth2 routes
app.use('/auth/oauth2', oauth2Routes);
```

### Step 5: Add Login Buttons to Frontend

Create OAuth2 login buttons in your React app:

```jsx
// LoginPage.jsx
const LoginPage = () => {
  const handleGoogleLogin = () => {
    window.location.href = '/auth/oauth2/google';
  };

  const handleEpicLogin = () => {
    window.location.href = '/auth/oauth2/epic';
  };

  return (
    <div>
      <button onClick={handleGoogleLogin}>
        Login with Google
      </button>
      <button onClick={handleEpicLogin}>
        Login with Epic MyChart
      </button>
    </div>
  );
};
```

### Step 6: Handle OAuth2 Callback

After successful OAuth2 login, handle the redirect:

```jsx
// Dashboard.jsx
useEffect(() => {
  // Get token from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    // Store token securely
    localStorage.setItem('authToken', token);
    // Clean URL
    window.history.replaceState({}, document.title, '/dashboard');
  }
}, []);
```

## Getting OAuth2 Credentials

### Google OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URIs: `http://localhost:3000/auth/oauth2/google/callback`
6. Copy Client ID and Client Secret

### Epic FHIR

1. Register at [Epic's FHIR Portal](https://fhir.epic.com/)
2. Create a new application
3. Select "Confidential" client type
4. Add redirect URI
5. Note: Production requires Epic's approval

### Cerner FHIR

1. Register at [Cerner's Developer Portal](https://fhir.cerner.com/)
2. Create SMART app
3. Configure redirect URIs
4. Get client credentials

## API Endpoints

### Authentication Endpoints

- `GET /auth/oauth2/google` - Initiate Google login
- `GET /auth/oauth2/google/callback` - Google callback
- `GET /auth/oauth2/:provider` - Initiate login for any provider
- `GET /auth/oauth2/:provider/callback` - Provider callback

### Token Management

- `POST /auth/oauth2/token/refresh` - Refresh access token
- `POST /auth/oauth2/token/revoke` - Revoke token (logout)
- `GET /auth/oauth2/token/info` - Get token metadata

### Account Management

- `POST /auth/oauth2/link/:provider` - Link OAuth2 to existing account
- `DELETE /auth/oauth2/unlink/:provider` - Unlink OAuth2 provider
- `GET /auth/oauth2/linked-providers` - List linked providers

### HIPAA Compliance

- `GET /auth/oauth2/audit-log` - Get user's authentication audit log
- `POST /auth/oauth2/consent` - Update data sharing consent
- `GET /auth/oauth2/consent` - Get current consent settings

## Security Features

1. **Token Encryption**: All OAuth2 tokens are encrypted before storage
2. **CSRF Protection**: State parameter validation
3. **Rate Limiting**: Prevents brute force attacks
4. **Audit Logging**: All OAuth2 events are logged for HIPAA
5. **HTTPS Enforcement**: Required in production
6. **Token Expiration**: Automatic token refresh
7. **Consent Management**: User consent before data sharing

## Testing

### Development Testing

Test OAuth2 configuration:
```bash
curl http://localhost:3000/auth/oauth2/test/config
```

Mock OAuth2 login (development only):
```bash
curl http://localhost:3000/auth/oauth2/test/mock-login
```

### Production Checklist

- [ ] Set all environment variables
- [ ] Enable HTTPS
- [ ] Configure production redirect URIs
- [ ] Set up audit log storage
- [ ] Test token refresh flow
- [ ] Verify HIPAA compliance features
- [ ] Set up rate limiting with Redis
- [ ] Configure session storage (MongoDB/Redis)

## Common Issues

### "Invalid redirect URI"
- Ensure callback URL matches exactly in provider console
- Check for trailing slashes
- Verify protocol (http vs https)

### "Token expired"
- Implement auto-refresh in frontend
- Check token expiration settings
- Ensure refresh token is stored

### "CSRF validation failed"
- Check session configuration
- Ensure cookies are enabled
- Verify state parameter handling

## HIPAA Compliance Notes

This OAuth2 implementation includes HIPAA-required features:

1. **Audit Logging**: All authentication events are logged
2. **Encryption**: Tokens are encrypted at rest
3. **Access Control**: Role-based permissions
4. **Token Expiration**: Short-lived tokens (15 minutes default)
5. **Consent Management**: Explicit user consent for data sharing
6. **Secure Communication**: HTTPS required in production

Remember: You still need Business Associate Agreements (BAAs) with any third-party services that handle PHI.

## Next Steps

1. **Choose providers**: Decide which OAuth2 providers to support
2. **Get credentials**: Register your app with chosen providers
3. **Configure environment**: Set all required environment variables
4. **Test locally**: Verify OAuth2 flow works
5. **Add to frontend**: Create login UI components
6. **Deploy**: Update redirect URIs for production

## Need Help?

- OAuth2 Spec: https://oauth.net/2/
- SMART on FHIR: https://docs.smarthealthit.org/
- Google OAuth2: https://developers.google.com/identity/protocols/oauth2
- Passport.js Docs: http://www.passportjs.org/docs/