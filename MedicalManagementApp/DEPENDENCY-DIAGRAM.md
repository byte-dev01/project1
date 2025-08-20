# HealthBridge Medical Management App - Module Dependency Diagram

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           App Entry Point                            │
│                              app.tsx                                 │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Navigation Layer                            │
│                     src/navigation/RootNavigator                     │
│                         app/(tabs)/_layout                           │
└──────┬───────────────────────────────────────────────┬──────────────┘
       │                                               │
       ▼                                               ▼
┌──────────────────────┐                   ┌─────────────────────────┐
│   Auth Navigation    │                   │    Main Navigation      │
│  - LoginScreen       │                   │  - Dashboard            │
│  - BiometricAuth     │                   │  - Patients             │
└──────────────────────┘                   │  - Medications          │
                                          │  - Faxes                │
                                          │  - Messages             │
                                          └─────────────────────────┘
```

## Module Dependency Tree

### 1. Core Security & Compliance Layer
```
src/core/
├── compliance/
│   ├── AuditTrail.ts ──────────────┐
│   │   ├─ Depends on:              │
│   │   │  • react-native-sqlite-storage
│   │   │  • crypto-js              │
│   │   │  • react-native-device-info
│   │   │  • @react-native-community/netinfo
│   │   │  • expo-crypto            │
│   │   └─ Exports: AuditTrailService
│   │
│   └── AuditLog.ts ────────────────┐
│       ├─ Depends on:              │
│       │  • AuditTrail.ts          │
│       │  • types/audit.types.ts   │
│       └─ Exports: auditLog        │
│                                    │
└── clinical/                        │
    └── ClinicalSafetyService.ts ───┘
        ├─ Depends on:
        │  • AuditLog.ts
        └─ Exports: ClinicalSafetyService
```

### 2. State Management Layer
```
store/
├── authStore.ts ───────────────────┐
│   ├─ Depends on:                  │
│   │  • zustand                    │
│   │  • SecureStorageService       │
│   │  • SecureAPIClient            │
│   │  • AuditLog                   │
│   └─ Exports: useAuthStore        │
│                                    │
├── patientStore.ts ────────────────┤
│   ├─ Depends on:                  │
│   │  • zustand                    │
│   │  • types/models.types.ts     │
│   └─ Exports: usePatientStore     │
│                                    │
├── faxStore.ts ────────────────────┤
│   ├─ Depends on:                  │
│   │  • zustand                    │
│   │  • types/models.types.ts     │
│   └─ Exports: useFaxStore         │
│                                    │
└── messageStore.ts ────────────────┘
    ├─ Depends on:
    │  • zustand
    │  • types/models.types.ts
    └─ Exports: useMessageStore
```

### 3. Services Layer
```
src/services/
├── SecureStorageService.ts ────────┐
│   ├─ Depends on:                  │
│   │  • expo-secure-store          │
│   │  • @react-native-async-storage/async-storage
│   │  • utils/encryption.ts        │
│   └─ Exports: SecureStorageService│
│                                    │
├── SecureAPIClient.ts ─────────────┤
│   ├─ Depends on:                  │
│   │  • SecureStorageService       │
│   │  • AuditLog                   │
│   │  • utils/encryption.ts        │
│   └─ Exports: SecureAPIClient     │
│                                    │
├── security.ts ────────────────────┤
│   ├─ Depends on:                  │
│   │  • expo-local-authentication  │
│   │  • SecureStorageService       │
│   └─ Exports: SecurityManager     │
│                                    │
└── simpleConsentServices.tsx ──────┘
    ├─ Depends on:
    │  • React Native components
    │  • SecureStorageService
    └─ Exports: SimpleConsentService
```

### 4. API Layer
```
src/api/                            api/
├── endpoints.ts                    ├── ApiClient.tsx
├── AuthApi.tsx ────────────┐       │   ├─ Depends on:
│   ├─ Depends on:          │       │   │  • expo-secure-store
│   │  • SecureAPIClient    │       │   │  • authStore
│   └─ Exports: AuthAPI     │       │   └─ Exports: ApiClient
│                           │       │
├── PatientsApi.tsx ────────┤       └── auth.ts
│   ├─ Depends on:          │           ├─ Depends on:
│   │  • SecureAPIClient    │           │  • ApiClient
│   │  • types/models.types │           └─ Exports: authService
│   └─ Exports: PatientsAPI │
│                           │
└── FaxApi.tsx ─────────────┘
    ├─ Depends on:
    │  • SecureAPIClient
    │  • types/models.types
    └─ Exports: FaxAPI
```

### 5. Domain Layer
```
domains/
├── auth/
│   └── services/
│       └── AuthService.ts
│           ├─ Depends on:
│           │  • authStore
│           │  • SecureStorageService
│           │  • AuditLog
│           └─ Exports: AuthService
│
├── patients/
│   ├── services/
│   │   └── PatientService.ts
│   │       ├─ Depends on:
│   │       │  • PatientsAPI
│   │       │  • patientStore
│   │       │  • AuditLog
│   │       └─ Exports: PatientService
│   └── components/
│       └── PatientCard.tsx
│
├── faxes/
│   ├── services/
│   │   └── FaxService.ts
│   │       ├─ Depends on:
│   │       │  • FaxAPI
│   │       │  • faxStore
│   │       │  • AuditLog
│   │       └─ Exports: FaxService
│   └── components/
│       └── FaxCard.tsx
│
└── messages/
    └── services/
        └── MessageService.ts
            ├─ Depends on:
            │  • messageStore
            │  • SecureAPIClient
            │  • AuditLog
            └─ Exports: MessageService
```

### 6. Screen/UI Layer
```
src/screens/                       app/(tabs)/
├── auth/                          ├── dashboard.tsx
│   └── LoginScreen.tsx ───────┐   │   ├─ Depends on:
│       ├─ Depends on:         │   │   │  • authStore
│       │  • AuthService       │   │   │  • patientStore
│       │  • authStore         │   │   │  • faxStore
│       │  • Navigation        │   │   └─ Uses: Dashboard UI
│       └─ Uses: Login UI      │   │
│                              │   ├── patients/
├── fax/                       │   │   ├── _layout.tsx
│   ├── FaxListScreen.tsx ────┤   │   ├── search.tsx
│   │   ├─ Depends on:        │   │   └── [id].tsx
│   │   │  • FaxService        │   │       ├─ Depends on:
│   │   │  • faxStore          │   │       │  • PatientService
│   │   └─ Uses: FaxList UI    │   │       │  • patientStore
│   │                          │   │       └─ Uses: Patient Detail UI
│   └── FaxDetailScreen.tsx ───┤   │
│       ├─ Depends on:         │   └── faxes/
│       │  • FaxService        │       ├── _layout.tsx
│       │  • faxStore          │       └── index.tsx
│       └─ Uses: FaxDetail UI  │           ├─ Depends on:
│                              │           │  • FaxService
└── SecurePrescriptionScreen.tsx           │  • faxStore
    ├─ Depends on:             │           └─ Uses: Fax List UI
    │  • SecureStorageService   │
    │  • SecureAPIClient        │
    │  • SimpleConsentService   │
    │  • AuditLog              │
    └─ Uses: Prescription UI   │
```

### 7. Utilities Layer
```
utils/
├── encryption.ts ──────────────────┐
│   ├─ Depends on:                  │
│   │  • crypto-js                  │
│   │  • expo-crypto                │
│   └─ Exports: encrypt/decrypt     │
│                                    │
├── auditLogger.ts ─────────────────┤
│   ├─ Depends on:                  │
│   │  • AuditTrail                 │
│   └─ Exports: auditLogger         │
│                                    │
├── sessionManager.ts ──────────────┤
│   ├─ Depends on:                  │
│   │  • SecureStorageService       │
│   │  • authStore                  │
│   └─ Exports: SessionManager      │
│                                    │
├── offline.ts ─────────────────────┤
│   ├─ Depends on:                  │
│   │  • @react-native-async-storage│
│   │  • @react-native-community/netinfo
│   └─ Exports: OfflineManager      │
│                                    │
└── notifications.ts ───────────────┘
    ├─ Depends on:
    │  • expo-notifications
    └─ Exports: NotificationService
```

## Data Flow Patterns

### 1. Authentication Flow
```
LoginScreen → AuthService → authStore → SecureAPIClient → Backend
     ↓              ↓            ↓              ↓
BiometricAuth → AuditLog → SecureStorage → Encryption
```

### 2. Patient Data Access Flow
```
PatientScreen → PatientService → SecureAPIClient → Backend
      ↓              ↓                  ↓
ConsentService → AuditLog → SecureStorage → Cache
```

### 3. Audit Trail Flow
```
Any Action → AuditLog → AuditTrailService → SQLite (Local)
                ↓              ↓                ↓
           Encryption → Hash Chain → Sync Queue → Backend
```

### 4. Offline Sync Flow
```
User Action → OfflineManager → AsyncStorage (Queue)
                    ↓                  ↓
              NetInfo Check → Sync when Online → Backend
```

## External Dependencies

### React Native Core
- react-native: 0.79.5
- react: 19.0.0
- react-native-web: ~0.20.0

### Expo SDK
- expo: ~53.0.20
- expo-secure-store: ^14.2.3
- expo-notifications: ^0.31.4
- expo-local-authentication: (via plugins)

### Navigation
- @react-navigation/native: ^7.1.6
- @react-navigation/bottom-tabs: ^7.3.10
- react-native-screens: ~4.11.1

### Data Storage
- react-native-sqlite-storage: ^6.0.1
- @react-native-async-storage/async-storage: ^2.2.0

### Security & Crypto
- crypto-js: ^4.2.0
- react-native-device-info: ^14.0.4

### State Management
- zustand: ^5.0.8

### Network
- @react-native-community/netinfo: ^11.4.1

### Utilities
- fuse.js: ^7.1.0 (Search)
- express: ^5.1.0 (Server)

## Security Boundaries

1. **Encryption Boundary**: All PHI data encrypted at rest and in transit
2. **Authentication Boundary**: Biometric + credential-based auth
3. **Audit Boundary**: All data access logged with tamper-proof hash chain
4. **Network Boundary**: HTTPS-only with certificate pinning
5. **Storage Boundary**: Secure Store for sensitive data, AsyncStorage for non-sensitive

## Compliance Checkpoints

- **HIPAA**: Audit logging, encryption, access controls
- **California Healthcare**: Minor consent, mental health protections
- **CCPA**: Data portability, deletion rights
- **42 CFR Part 2**: Substance abuse data protections

## Performance Optimizations

1. **Lazy Loading**: Screens and heavy components loaded on demand
2. **Caching**: Frequently accessed data cached in memory
3. **Batch Operations**: Audit logs and sync operations batched
4. **Offline First**: Critical data preloaded for offline access
5. **Image Optimization**: Medical documents and images optimized

## Summary of Changes Made

### Fixed Issues:
1. **Renamed files from .ts to .tsx** for files containing JSX
   - src/hooks/useAuditedAction.ts → .tsx
   - src/services/simpleConsentServices.ts → .tsx
   - src/screens/SecurePrescriptionScreen.ts → .tsx

2. **Fixed AuditTrail.ts structure**
   - Reorganized class methods properly
   - Added missing imports and type definitions
   - Implemented proper TypeScript interfaces

3. **Updated tsconfig.json**
   - Changed moduleResolution to "bundler"
   - Added proper path mappings
   - Fixed type resolution issues

4. **Installed missing dependencies**
   - expo-secure-store
   - expo-notifications
   - @react-native-community/netinfo
   - react-native-sqlite-storage
   - @react-native-async-storage/async-storage
   - crypto-js
   - react-native-device-info
   - zustand
   - fuse.js
   - express and @types/express

5. **Created comprehensive type definitions**
   - types/audit.types.ts with all audit-related types
   - types/models.types.ts with domain models
   - types/navigation.types.ts for navigation

### Module Connections:
- **Core → Services**: Audit and compliance services used by all other services
- **Services → Store**: Services update global state via Zustand stores
- **Store → UI**: React components subscribe to store changes
- **UI → Services**: User actions trigger service methods
- **All → Audit**: Every data access logged through audit system

The application follows a layered architecture with clear separation of concerns and comprehensive security/compliance features throughout.