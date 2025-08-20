# HealthBridge Medical Management App - Claude Development Guide

## Project Overview

HealthBridge is a **HIPAA-compliant React Native medical management application** built with Expo. It enables healthcare providers to securely manage patient records, prescriptions, fax communications, and provider messaging while maintaining strict compliance with healthcare regulations.

## Tech Stack

### Core Technologies
- **Framework**: React Native 0.79.5 with Expo SDK 53
- **Language**: TypeScript with strict mode enabled
- **State Management**: Zustand for client-side state
- **Navigation**: React Navigation 7 (Stack + Bottom Tabs)
- **Styling**: Custom theme system with design tokens

### Security & Compliance
- **Storage**: Expo Secure Store + AsyncStorage with AES encryption
- **Authentication**: Biometric (Face ID/Touch ID) + credential-based
- **Network**: Enforced HTTPS with certificate pinning
- **Audit**: SQLite-based comprehensive audit logging
- **Compliance**: HIPAA + California healthcare regulations

### Key Dependencies
```json
{
  "@react-navigation/native": "^7.1.6",
  "@react-navigation/bottom-tabs": "^7.3.10",
  "expo-secure-store": "Latest via plugins",
  "expo-local-authentication": "Latest via plugins", 
  "react-native-sqlite-storage": "Latest",
  "zustand": "Latest"
}
```

## Application Architecture

### Navigation Hierarchy
```
RootNavigator
├── AuthNavigator (when !authenticated)
│   └── LoginScreen (biometric + credential auth)
└── MainNavigator (when authenticated)
    ├── Dashboard (Tab 1)
    ├── FaxNavigator (Tab 2)
    │   ├── FaxListScreen
    │   └── FaxDetailScreen
    ├── PatientNavigator (Tab 3)
    │   ├── PatientSearchScreen
    │   ├── PatientDetailScreen
    │   ├── NewPatient (PatientForm)
    │   ├── PatientEdit (PatientForm)
    │   └── InsuranceForm
    ├── MessageNavigator (Tab 4)
    │   └── MessageListScreen
    └── More (Tab 5 - Settings/Logout)
```

### Directory Structure & Path Aliases
```
src/
├── api/                    (@api/*)
│   ├── AuthApi.tsx        # Authentication endpoints
│   ├── PatientsApi.tsx    # Patient management
│   ├── FaxApi.tsx         # Fax processing
│   └── endpoints.ts       # API endpoint definitions
├── components/             (@components/*)
│   ├── common/            # Reusable components
│   ├── forms/             # Form components
│   ├── fax/               # Fax-specific components
│   └── ui/                # UI primitives
├── screens/                (@screens/*)
│   ├── auth/              # Authentication screens
│   ├── fax/               # Fax management
│   └── [feature]/         # Feature-specific screens
├── services/               # Core services
│   ├── SecureStorageService.ts    # Encrypted storage
│   ├── SecureAPIClient.ts         # HTTPS-only API client
│   └── security.ts                # Security manager
├── store/                  (@store/*)
│   ├── authStore.ts       # Authentication state
│   ├── patientStore.ts    # Patient data
│   └── faxStore.ts        # Fax message state
├── core/                   # Business logic
│   ├── compliance/        # HIPAA/CA compliance
│   └── clinical/          # Clinical safety services
├── navigation/             (@navigation/*)
├── types/                  (@types/*)
├── theme/                  (@theme/*)
└── utils/                  (@utils/*)
```

## Security Architecture

### Multi-Layer Security Model
1. **Transport Layer**: HTTPS-only with certificate validation
2. **Storage Layer**: AES encryption for all PHI data
3. **Authentication**: Biometric + multi-factor
4. **Audit Layer**: Comprehensive logging with integrity chains
5. **Application Layer**: Screenshot prevention, app backgrounding protection

### Key Security Services

#### SecureStorageService
```typescript
// Automatically encrypts/decrypts PHI data
await SecureStorageService.setSecureItem('prescription_123', prescriptionData);
const data = await SecureStorageService.getSecureItem('prescription_123');
```

#### SecureAPIClient  
```typescript
// Enforces HTTPS, adds auth headers, logs requests
const prescriptions = await SecureAPIClient.get('/patients/123/prescriptions');
```

#### AuditLogService
```typescript
// HIPAA-compliant audit logging
await auditLog.log({
  action: 'VIEW',
  resourceType: 'PRESCRIPTION', 
  patientId: '123',
  userId: currentUser.id,
  purpose: 'TREATMENT'
});
```

## Development Patterns

### State Management with Zustand
```typescript
// Store pattern for feature state
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  login: async (username, password, clinicId) => {
    // Login logic with security logging
  },
  logout: async () => {
    // Secure cleanup
  }
}));
```

### Component Patterns
```typescript
// Consistent component structure
export const ComponentName: React.FC<Props> = ({ ...props }) => {
  // Hooks
  // State  
  // Effects
  // Handlers
  // Render
  return (
    <SafeAreaWrapper>
      {/* Component JSX */}
    </SafeAreaWrapper>
  );
};
```

### Theme Usage
```typescript
// Consistent design system usage
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  }
});
```

## Compliance Requirements

### HIPAA Compliance Features
- ✅ Encrypted data at rest and in transit
- ✅ Comprehensive audit logging
- ✅ Access controls and authentication
- ✅ Session timeouts and automatic logout
- ✅ Secure PHI handling and storage

### California Healthcare Compliance
- ✅ Minor patient access controls
- ✅ Mental health data protections (LPS Act)
- ✅ Knox-Keene Act compliance
- ✅ Substance abuse data protections (42 CFR Part 2)
- ✅ Data retention policies (7 years adult, until age 25 for minors)

## Key Features

### 1. Fax Processing System
- AI-powered severity analysis with scoring (轻度/中度/重度/紧急)
- OCR text extraction and transcription
- Automatic patient matching and assignment
- Priority-based workflow management

### 2. Patient Management
- Comprehensive patient search and records
- Insurance verification and form management
- Medical history tracking with encrypted storage
- Allergy and medication management

### 3. Secure Messaging
- Provider-to-provider encrypted communication
- Message threading and attachment support
- Audit logging for all message activities
- Urgent message prioritization

### 4. Clinical Safety
- Drug interaction checking
- Prescription management with CURES2 integration
- Clinical decision support tools
- Automated safety alerts

## Development Scripts

```bash
# Development
npm start                 # Start Expo dev server
npm run android          # Run on Android emulator  
npm run ios             # Run on iOS simulator
npm run web             # Run on web browser

# Code Quality
npm run lint            # ESLint checking
npm run reset-project   # Reset to blank template

# Testing (when configured)
npm test                # Run unit tests
npm run e2e             # Run Playwright E2E tests
```

## Environment Setup

### Required for Development
1. **Expo CLI**: `npm install -g @expo/cli`
2. **iOS Development**: Xcode + iOS Simulator
3. **Android Development**: Android Studio + AVD
4. **Security Testing**: Device with biometric capabilities

### Configuration Files
- `app.json` - Expo app configuration with security permissions
- `tsconfig.json` - TypeScript config with strict mode + path aliases
- `babel.config.js` - Babel config with module resolver for aliases
- `eslint.config.js` - ESLint config using Expo defaults

## Security Considerations for Development

### Never Commit
- Real API keys or secrets
- Actual patient data or PHI
- Production authentication credentials
- Hardcoded encryption keys

### Always Ensure
- HTTPS-only API communication
- Encrypted storage for any sensitive data
- Proper audit logging for all PHI access
- Biometric authentication testing on real devices
- Session timeout implementation

### Testing PHI Compliance
- Use synthetic/mock patient data only
- Test encryption/decryption flows
- Verify audit log completeness
- Test offline sync and conflict resolution
- Validate session management and timeouts

## Common Development Tasks

### Adding New Screens
1. Create in appropriate `src/screens/[feature]/` directory
2. Add to navigation types in `types/navigation.types.ts`
3. Update navigator configuration
4. Implement security audit logging if accessing PHI

### Adding New API Endpoints
1. Add endpoint to `src/api/endpoints.ts`
2. Create or update corresponding API service file
3. Ensure HTTPS-only communication via SecureAPIClient
4. Add proper error handling and audit logging

### Adding New Features
1. Create feature directory under `src/`
2. Implement business logic in `src/core/`
3. Add Zustand store if needed in `store/`
4. Create reusable components in `components/`
5. Add proper TypeScript types in `types/`
6. Ensure HIPAA compliance and audit logging

## Performance Considerations

### Optimization Strategies
- Use React.memo for expensive components
- Implement proper list virtualization for large datasets
- Lazy load screens and heavy components
- Optimize image loading and caching
- Monitor bundle size and implement code splitting

### Security vs Performance Balance
- Encryption/decryption adds overhead - use judiciously
- Audit logging is comprehensive - balance detail vs performance
- Biometric authentication adds UI flow complexity
- Secure storage operations are slower than regular storage

## Production Deployment

### Security Checklist
- [ ] All API communications over HTTPS
- [ ] Certificate pinning implemented
- [ ] Encryption keys properly managed
- [ ] Audit logging fully implemented
- [ ] Session timeouts configured
- [ ] Screenshot/recording prevention enabled
- [ ] Compliance requirements verified

### Build Configuration
- Configure proper signing certificates
- Set up proper environment variables
- Ensure security permissions are minimal
- Test on real devices with biometrics
- Validate offline functionality

---

## Quick Reference

### Most Important Files
- `app.tsx` - Main app entry point with security initialization
- `src/navigation/RootNavigator.tsx` - Navigation structure
- `src/services/SecureStorageService.ts` - Encrypted storage
- `src/core/compliance/AuditLog.ts` - HIPAA audit logging
- `src/store/authStore.ts` - Authentication state management

### Key Commands for Claude
```bash
# Start development
npm install && npm start

# Check code quality  
npm run lint

# Common file operations
# Read: C:\Users\rache\catbook\MedicalManagementApp\src\[path]
# Edit: Use absolute paths with @aliases in imports
```

### Architecture Principles
1. **Security First**: All PHI handling must be encrypted and audited
2. **Compliance by Design**: HIPAA and California regulations built-in
3. **User Experience**: Intuitive medical workflows with proper error handling
4. **Maintainability**: Clean architecture with TypeScript and proper separation
5. **Performance**: Efficient data handling with offline-first capabilities

This codebase represents a production-ready medical application with enterprise-level security and compliance requirements. Always prioritize patient data protection and regulatory compliance in any modifications.