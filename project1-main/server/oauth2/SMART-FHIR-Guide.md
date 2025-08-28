# SMART on FHIR Implementation Guide

## Table of Contents
1. [What is SMART on FHIR?](#what-is-smart-on-fhir)
2. [Key Security Concepts](#key-security-concepts)
3. [How SMART on FHIR Works](#how-smart-on-fhir-works)
4. [Implementation Details](#implementation-details)
5. [Testing with Sandbox](#testing-with-sandbox)
6. [Production Deployment](#production-deployment)

## What is SMART on FHIR?

**SMART on FHIR** (Substitutable Medical Applications, Reusable Technologies) is a healthcare standard that enables:
- Secure access to Electronic Health Records (EHRs)
- Standardized authentication across different hospital systems
- Apps that work with Epic, Cerner, Allscripts, and other major EHRs
- Patient data portability

Think of it as "Login with Epic" or "Login with Cerner" - similar to "Login with Google" but for healthcare.

## Key Security Concepts

### 1. Passport.js
**What it is**: Authentication middleware for Node.js
**Analogy**: Like a security guard that checks different types of ID cards

```javascript
// Without Passport.js - you write authentication for each provider
if (provider === 'google') {
  // Google auth code
} else if (provider === 'epic') {
  // Epic auth code
}

// With Passport.js - clean and reusable
passport.use('google', googleStrategy);
passport.use('epic', epicStrategy);
```

### 2. Encryption at Rest vs. In Transit

#### Encryption in Transit (TLS/SSL)
- **What**: Data encrypted while traveling over network
- **How**: HTTPS protocol
- **Analogy**: Armored truck delivering money

```javascript
// In Transit - using HTTPS
https://api.hospital.com/patient/123  // ✅ Encrypted
http://api.hospital.com/patient/123   // ❌ Not encrypted

// In our code
app.use(helmet()); // Forces HTTPS headers
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

#### Encryption at Rest
- **What**: Data encrypted when stored in database
- **How**: Encrypt before saving, decrypt after reading
- **Analogy**: Safe deposit box in a bank

```javascript
// At Rest - in our OAuth2 implementation
// Before saving to database
const encryptedToken = encryptToken(accessToken);
user.oauth2Tokens = encryptedToken;
await user.save();

// When reading from database
const decryptedToken = decryptToken(user.oauth2Tokens);
// Use decryptedToken for API calls
```

### 3. Why Both Types of Encryption?

```
User Browser → [HTTPS/TLS] → Your Server → [Encrypted] → Database
     ↑              ↑                           ↑
     |              |                           |
   At risk      In Transit                   At Rest
   from XSS     Protection                 Protection
```

- **Transit**: Protects from network sniffing, man-in-the-middle attacks
- **Rest**: Protects from database breaches, insider threats

## How SMART on FHIR Works

### Launch Flow Diagram

```
1. EHR Launch (Doctor clicks your app in Epic)
   ↓
2. EHR sends: /launch?iss=epic.com&launch=abc123
   ↓
3. Your app redirects to Epic authorization
   ↓
4. Doctor approves access
   ↓
5. Epic redirects back with authorization code
   ↓
6. Your app exchanges code for access token
   ↓
7. Use token to fetch patient data
```

### Two Types of Launch

#### 1. EHR Launch (Contextual)
- Launched from within EHR (Epic, Cerner)
- Has patient already selected
- Doctor is already logged in

```javascript
// EHR provides context
GET /launch?iss=https://fhir.epic.com&launch=eyJhIjoiMSJ9
// 'launch' contains encrypted patient context
```

#### 2. Standalone Launch
- Launched from your website
- User selects patient after login
- Like regular OAuth2

```javascript
// No launch parameter, user will select patient
GET /auth/smart/epic/standalone
```

## Implementation Details

### File Structure
```
server/oauth2/
├── strategies/
│   └── smartFhirStrategy.js     # SMART on FHIR Passport strategy
├── config/
│   └── smart-fhir.config.js     # EHR configurations
├── routes/
│   └── smart-fhir.routes.js     # SMART endpoints
├── controllers/
│   └── smart-fhir.controller.js # Business logic
```

### Setting Up SMART on FHIR

#### 1. Configure Your EHR Credentials

```env
# Epic Configuration
EPIC_CLIENT_ID=your-epic-app-id
EPIC_CLIENT_SECRET=your-epic-secret
EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_CALLBACK_URL=https://yourapp.com/auth/smart/epic/callback

# Cerner Configuration
CERNER_CLIENT_ID=your-cerner-app-id
CERNER_TENANT_ID=your-tenant
CERNER_FHIR_URL=https://fhir-myrecord.cerner.com/r4/your-tenant
```

#### 2. Initialize SMART Strategy

```javascript
// In your server.js
const { initializeSMARTStrategy } = require('./oauth2/strategies/smartFhirStrategy');
const smartConfig = require('./oauth2/config/smart-fhir.config');

// Initialize for each EHR
initializeSMARTStrategy('epic', smartConfig.epic, User);
initializeSMARTStrategy('cerner', smartConfig.cerner, User);

// Mount SMART routes
app.use('/auth/smart', smartFhirRoutes);
```

#### 3. Handle Launch in Frontend

```jsx
// React component for SMART launch
const SMARTLauncher = () => {
  useEffect(() => {
    // Check if launched from EHR
    const params = new URLSearchParams(window.location.search);
    const iss = params.get('iss');
    const launch = params.get('launch');
    
    if (iss && launch) {
      // Redirect to backend launch handler
      window.location.href = `/auth/smart/launch?iss=${iss}&launch=${launch}`;
    }
  }, []);
  
  return <div>Connecting to EHR...</div>;
};
```

### Fetching Patient Data

Once authenticated, you can fetch FHIR resources:

```javascript
// Get patient demographics
const patient = await fetch('/auth/smart/fhir/Patient/123', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Get conditions (diagnoses)
const conditions = await fetch('/auth/smart/fhir/Condition?patient=123', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Get medications
const meds = await fetch('/auth/smart/fhir/MedicationRequest?patient=123', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### FHIR Resources Explained

| Resource | Contains | Example |
|----------|----------|---------|
| Patient | Demographics | Name, DOB, address |
| Condition | Diagnoses | Diabetes, Hypertension |
| MedicationRequest | Current meds | Metformin 500mg |
| Observation | Vitals & labs | Blood pressure, glucose |
| AllergyIntolerance | Allergies | Penicillin allergy |
| Immunization | Vaccines | COVID-19, Flu shot |
| Procedure | Past procedures | Surgery, biopsy |

## Testing with Sandbox

### 1. Use SMART Health IT Sandbox

No registration required! Test immediately:

```javascript
// Configure sandbox
const sandboxConfig = {
  fhirBaseURL: 'https://launch.smarthealthit.org/v/r4/fhir',
  authorizationURL: 'https://launch.smarthealthit.org/v/r4/auth/authorize',
  tokenURL: 'https://launch.smarthealthit.org/v/r4/auth/token',
  clientID: 'my_web_app', // Any string works
  clientSecret: '', // Public client, no secret needed
  callbackURL: 'http://localhost:3000/auth/smart/sandbox/callback'
};
```

### 2. Test Launch URL

```
http://launch.smarthealthit.org/launcher?launch_url=http://localhost:3000/launch
```

### 3. Select Test Patient

The sandbox provides test patients with realistic data:
- Daniel Adams (adult male)
- Jessica Langer (adult female)
- Todd Lerr (pediatric)

## Production Deployment

### 1. Security Checklist

- [ ] **HTTPS Only**: Enforce TLS/SSL
```javascript
app.use(enforceHTTPS);
```

- [ ] **Encrypt Tokens**: Never store plain text tokens
```javascript
user.oauth2Tokens = encryptToken(accessToken);
```

- [ ] **Validate State**: Prevent CSRF attacks
```javascript
if (req.query.state !== sessionState) {
  throw new Error('Invalid state - CSRF attack?');
}
```

- [ ] **Use PKCE**: Additional OAuth2 security
```javascript
// Implemented in our SMARTStrategy
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = sha256(verifier);
```

- [ ] **Audit Logging**: HIPAA requirement
```javascript
console.log('AUDIT:', {
  event: 'patient_data_access',
  user: userId,
  patient: patientId,
  timestamp: new Date().toISOString()
});
```

### 2. EHR Registration

#### Epic
1. Go to [Epic's FHIR Portal](https://fhir.epic.com/)
2. Create "Background" or "Patient Standalone" app
3. Submit for review (takes 2-4 weeks)
4. Get production credentials

#### Cerner
1. Register at [Cerner Code](https://code.cerner.com/)
2. Create SMART app
3. Complete security assessment
4. Deploy to Cerner's app gallery

### 3. HIPAA Compliance

Our implementation includes:
- ✅ Audit logging
- ✅ Token encryption
- ✅ Session timeouts
- ✅ Consent management
- ✅ Secure token storage
- ✅ HTTPS enforcement

You still need:
- Business Associate Agreement (BAA) with hospitals
- HIPAA policies and procedures
- Security risk assessment
- Employee training

## Common Issues & Solutions

### "Invalid redirect URI"
```javascript
// Ensure exact match
callbackURL: 'https://app.com/callback' // ✅
callbackURL: 'https://app.com/callback/' // ❌ Trailing slash
```

### "Token expired"
```javascript
// Auto-refresh implementation
if (tokenExpired) {
  const newToken = await refreshSMARTToken(refreshToken);
}
```

### "No patient context"
```javascript
// Check launch type
if (!smartContext.patient) {
  // Standalone launch - ask user to select patient
  redirectToPatientSelector();
}
```

## Testing Your Implementation

### 1. Test with Sandbox
```bash
# Start your server
npm start

# Visit sandbox launcher
open http://launch.smarthealthit.org/launcher?launch_url=http://localhost:3000/launch
```

### 2. Verify Token
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/auth/smart/fhir/Patient/123
```

### 3. Check Audit Logs
```bash
tail -f logs/oauth2-audit.log
```

## Resources

- [SMART on FHIR Docs](https://docs.smarthealthit.org/)
- [FHIR Resource Guide](https://www.hl7.org/fhir/resourcelist.html)
- [Epic FHIR APIs](https://fhir.epic.com/)
- [Cerner FHIR APIs](https://fhir.cerner.com/)
- [SMART Sandbox](http://launch.smarthealthit.org/)

## Next Steps

1. **Test with Sandbox**: Get familiar with SMART flow
2. **Choose EHRs**: Decide which systems to support
3. **Register Apps**: Apply for production credentials
4. **Implement UI**: Create patient data views
5. **Add Features**: Medications, allergies, conditions
6. **Deploy Securely**: Follow production checklist