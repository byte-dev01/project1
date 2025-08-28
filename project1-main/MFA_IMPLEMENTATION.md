# Multi-Factor Authentication (MFA) Implementation

## Overview
Complete MFA system with support for TOTP (Time-based One-Time Password), SMS, and backup recovery codes.

## Features

### Authentication Methods
1. **TOTP (Authenticator Apps)**
   - QR code generation for easy setup
   - Manual key entry option
   - Compatible with Google Authenticator, Microsoft Authenticator, Authy, etc.
   - 30-second time windows with 2-step tolerance

2. **SMS Verification**
   - Phone number validation and formatting
   - Twilio integration for SMS delivery
   - Verification code expiry (10 minutes)
   - Rate limiting and retry protection

3. **Backup Recovery Codes**
   - One-time use codes for emergency access
   - 10 codes generated per set
   - Secure storage with hashing
   - Download and copy functionality
   - Usage tracking and warnings

### Security Features
- Encrypted storage of secrets
- Session-based MFA verification
- Trusted device management
- Comprehensive audit logging
- Maximum verification attempts (5)
- Grace periods for enforcement
- PHI/PII protection compliance

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install speakeasy qrcode twilio
```

### 2. Environment Configuration
Add to `.env`:
```env
# Twilio Configuration (for SMS)
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# MFA Settings
MFA_ENFORCEMENT_GRACE_PERIOD=7
MFA_SESSION_DURATION=3600000
MFA_REMEMBER_DEVICE_DURATION=2592000000
```

### 3. Database Migration
Run MongoDB to create MFA collections:
```javascript
// Collections created automatically:
// - mfasettings
// - mfaverifications
// - mfaaudits
// - recoverycodes
```

### 4. Update Server Routes
Add to `server/server.js`:
```javascript
const mfaRoutes = require('./app/routes/mfa.routes');
app.use('/api/mfa', mfaRoutes);
```

## API Endpoints

### MFA Management
- `GET /api/mfa/status` - Get user's MFA status
- `POST /api/mfa/totp/setup` - Initialize TOTP setup
- `POST /api/mfa/totp/verify` - Verify TOTP token
- `POST /api/mfa/sms/setup` - Initialize SMS setup
- `POST /api/mfa/sms/verify` - Verify SMS code
- `POST /api/mfa/sms/resend` - Resend SMS verification
- `POST /api/mfa/backup-codes/generate` - Generate backup codes
- `DELETE /api/mfa/methods/:method` - Disable MFA method
- `GET /api/mfa/trusted-devices` - List trusted devices
- `DELETE /api/mfa/trusted-devices/:deviceId` - Remove trusted device

### Authentication with MFA
- `POST /api/auth/signin` - Initial login (returns MFA challenge if enabled)
- `POST /api/auth/mfa/verify` - Complete MFA verification

## Frontend Integration

### 1. Login Flow with MFA
```javascript
// In your login component
const handleLogin = async (credentials) => {
  const response = await authService.login(credentials);
  
  if (response.requiresMFA) {
    // Show MFA verification component
    return <MFAVerification 
      tempToken={response.tempToken}
      availableMethods={response.availableMethods}
      onSuccess={handleMFASuccess}
    />;
  }
  
  // Regular login success
  handleLoginSuccess(response);
};
```

### 2. MFA Setup in User Settings
```javascript
import MFASetup from './components/modules/MFASetup';

// In user settings/profile page
<MFASetup 
  userId={currentUser.id}
  token={authToken}
  onComplete={handleMFASetupComplete}
/>
```

## Security Best Practices

1. **Secret Storage**
   - Never log or expose MFA secrets
   - Use `select: false` in Mongoose schemas
   - Hash backup codes before storage

2. **Rate Limiting**
   - Implement attempt limits (5 attempts)
   - Progressive delays after failed attempts
   - Account lockout after threshold

3. **Audit Logging**
   - Log all MFA events
   - Include IP addresses and user agents
   - Retain logs for compliance (90 days)

4. **Session Management**
   - Short-lived MFA sessions (1 hour)
   - Require re-verification for sensitive actions
   - Clear sessions on logout

## Testing

### Manual Testing
1. **TOTP Setup**
   - Install Google Authenticator on test device
   - Navigate to MFA settings
   - Scan QR code or enter manual key
   - Verify with generated code

2. **SMS Testing (Development)**
   - Set `TWILIO_ENABLED=false` in `.env`
   - Verification codes will log to console
   - Use logged codes for testing

3. **Backup Codes**
   - Generate codes in settings
   - Save/download codes
   - Test login with backup code
   - Verify one-time use

### Automated Testing
```javascript
// Example test for TOTP verification
describe('MFA TOTP', () => {
  it('should verify valid TOTP token', async () => {
    const secret = 'TEST_SECRET';
    const token = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });
    
    const result = await mfaService.verifyTOTP(userId, token);
    expect(result.success).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues

1. **TOTP Time Sync Issues**
   - Ensure server time is synchronized (NTP)
   - Use window tolerance (2 steps = ±60 seconds)
   - Check user device time settings

2. **SMS Delivery Failed**
   - Verify Twilio credentials
   - Check phone number format (+1XXXXXXXXXX)
   - Review Twilio logs for errors
   - Ensure sufficient Twilio balance

3. **QR Code Not Scanning**
   - Increase QR code size
   - Ensure good contrast
   - Provide manual entry option
   - Test with different authenticator apps

## Compliance

### HIPAA Compliance
- PHI protection in audit logs
- Encrypted transmission (HTTPS)
- Access controls and authentication
- Audit trail maintenance

### Security Standards
- NIST 800-63B compliance
- TOTP RFC 6238 implementation
- SMS considered backup method only
- Regular security reviews required

## Monitoring

### Key Metrics
- MFA adoption rate
- Method usage distribution
- Verification success/failure rates
- Average verification time
- Backup code usage frequency

### Alerts
- Multiple failed verification attempts
- Unusual login patterns
- Backup codes running low
- SMS delivery failures

## Future Enhancements

1. **WebAuthn/FIDO2 Support**
   - Hardware security keys
   - Platform authenticators
   - Passwordless authentication

2. **Push Notifications**
   - App-based push approval
   - Rich notifications with context
   - Geolocation verification

3. **Adaptive Authentication**
   - Risk-based MFA triggers
   - Device fingerprinting
   - Behavioral analytics

4. **Enterprise Features**
   - Organizational MFA policies
   - Bulk enrollment
   - Delegated administration
   - SSO integration