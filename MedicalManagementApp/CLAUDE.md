# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HealthBridge is a HIPAA-compliant React Native medical management application built with Expo SDK 53. It provides healthcare providers with tools for patient management, prescriptions, fax processing, and secure messaging.

## Key Commands

```bash
# Development
npm start                 # Start Expo development server
npm run android          # Run on Android
npm run ios              # Run on iOS  
npm run web              # Run in web browser

# Code Quality
npm run lint             # Run ESLint

# Utilities
npm run reset-project    # Reset to blank Expo template
```

## Architecture Overview

### Tech Stack
- **Framework**: React Native 0.79.5 + Expo SDK 53
- **State Management**: Zustand stores in `/store`
- **Navigation**: React Navigation 7 (Stack + Bottom Tabs)
- **Security**: Expo Secure Store, biometric auth, AES encryption
- **Database**: SQLite for audit logging
- **Language**: TypeScript with strict mode

### Navigation Structure

The app uses a dual-navigation pattern:
- **Unauthenticated**: Login → Main app
- **Authenticated**: Bottom tabs with nested stacks

Main navigation tabs:
1. **Dashboard** - Overview and quick actions
2. **Patients** - Patient management system
3. **Medications** - Prescription handling
4. **Faxes** - AI-powered fax processing
5. **Messages** - Secure provider messaging

### Security Architecture

**Critical**: This is a HIPAA-compliant healthcare application. All development must maintain:
- Patient data encryption at rest and in transit
- Comprehensive audit logging for all PHI access
- Session management with automatic timeout
- Biometric authentication support
- Input validation and sanitization

Key security implementations:
- `utils/encryption.ts` - AES-256 encryption utilities
- `utils/auditLogger.ts` - HIPAA-compliant audit logging
- `utils/sessionManager.ts` - Session lifecycle management
- `domains/auth/services/AuthService.ts` - Authentication logic

### Core Services

**Patient Management** (`domains/patients/`)
- CRUD operations with encryption
- Medical record management
- Document attachments
- Visit history tracking

**Fax Processing** (`domains/faxes/`)
- AI-powered text extraction and categorization
- Severity scoring (URGENT/HIGH/NORMAL/LOW)
- Auto-attachment to patient records
- Action item extraction

**Messaging** (`domains/messages/`)
- End-to-end encrypted provider messaging
- Read receipts and typing indicators
- Message attachments
- Thread management

**Prescription Management** (`domains/medications/`)
- Electronic prescribing
- Drug interaction checking
- Refill management
- Medication history

### Data Flow

1. **API Layer** (`api/`) - Centralized API client with auth headers
2. **Domain Services** - Business logic in `/domains/[feature]/services`
3. **Zustand Stores** (`store/`) - Global state management
4. **UI Components** - React Native screens and components
5. **Local Storage** - Expo Secure Store for sensitive data

### Path Aliases

The project uses TypeScript path aliases for clean imports:
- `@/` → Root directory
- `@domains/` → Domain modules
- `@store/` → State management
- `@utils/` → Utilities
- `@theme/` → Theme configuration
- `@constants/` → App constants
- `@types/` → TypeScript definitions

### Development Patterns

**Component Structure**:
- Screens in `app/(tabs)/` or `app/screens/`
- Shared components in domain folders
- Custom hooks in domain services

**State Management**:
- Zustand stores for global state
- React hooks for local state
- Persist sensitive data with Secure Store

**Error Handling**:
- Global error boundary in app layout
- Service-level try-catch blocks
- User-friendly error messages

### Testing Approach

Currently no test framework is configured. When adding tests:
- Consider Jest + React Native Testing Library
- Test security-critical functions first
- Mock Expo modules appropriately
- Ensure PHI is never logged in tests

### Important Files

- `app/_layout.tsx` - Root navigation setup
- `api/client.ts` - API configuration
- `store/authStore.ts` - Authentication state
- `utils/encryption.ts` - Encryption utilities
- `constants/config.ts` - App configuration
- `theme/colors.ts` - Design system colors

## Compliance Requirements

When developing features:
1. Never log PHI to console in production
2. Always encrypt patient data before storage
3. Implement audit logging for all data access
4. Validate and sanitize all user inputs
5. Use HTTPS for all network requests
6. Implement proper session timeout
7. Clear sensitive data on logout

## Quick Reference

**Add a new screen**: Create in `app/screens/` and add to navigation
**Add a new API endpoint**: Update `api/client.ts` and create service in relevant domain
**Add global state**: Create new store in `store/` directory
**Add a new domain**: Create folder structure in `domains/` with services, types, and components
**Update theme**: Modify files in `theme/` directory