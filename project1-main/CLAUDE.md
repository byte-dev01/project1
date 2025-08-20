# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack medical records management application built on the Catbook React framework. It combines patient management, real-time messaging, medical document processing, and appointment scheduling.

## Tech Stack

- **Frontend**: React 16.14, Webpack, TailwindCSS, Socket.IO client
- **Backend**: Node.js, Express 4, MongoDB (Mongoose 5), Socket.IO
- **Testing**: Playwright for E2E testing
- **Security**: JWT authentication, bcrypt, helmet, CORS, express-rate-limit
- **Document Processing**: Tesseract.js (OCR), Google Cloud Document AI, pdf-parse
- **AI Integration**: DeepSeek API for medical transcription analysis
- **External Services**: Twilio for fax/SMS, Nodemailer for email

## Development Commands

```bash
# Start backend server with auto-restart (runs on port 3000)
npm start

# Start frontend dev server with hot reload (runs on port 5000)
npm run hotloader

# Run both servers for development - start in separate terminals
# Then visit http://localhost:5000
```

## Architecture

### Database Structure
The application uses multiple MongoDB databases for separation of concerns:
- **bezkoder_db**: Authentication and user management with role-based access
- **fax-database**: Fax processing and medical transcriptions
- **chat-database**: Real-time messaging data
- **patient-database**: Patient medical records
- **cat-database**: Original catbook social features
- **event-database**: Calendar and appointment scheduling

### Authentication System
- Uses JWT tokens with secure session management
- 6 user roles: `user`, `clinic_admin`, `staff`, `moderator`, `doctor`, `admin`
- Role-based middleware in `server/app/middleware/`
- Auth routes in `server/app/routes/auth.routes.js`

### Frontend Structure
- **Pages** (`client/src/components/pages/`): Main application views
  - Dashboard, Login, Calendar, Medical Recorder, Chat
- **Modules** (`client/src/components/modules/`): Reusable UI components
- **Contexts** (`client/src/components/contexts/`): React contexts for auth and app state
- **API calls**: Use the proxy configuration - frontend on :5000 proxies to backend on :3000

### Backend API Structure
- **Main API routes**: `server/api.js`
- **Auth routes**: `server/app/routes/`
- **Controllers**: Business logic in `server/controllers/` and `server/app/controllers/`
- **Models**: MongoDB schemas in `server/models/` and `server/app/models/`
- **Middleware**: Security and auth middleware applied globally in `server/server.js`

### Real-time Features
- Socket.IO for live updates (chat, notifications)
- MongoDB change streams for database event monitoring
- Connection handling in `server/server-socket.js`

### Document Processing Pipeline
1. Fax/document upload → `server/controllers/faxController.js`
2. OCR processing → Tesseract.js or Google Document AI
3. AI analysis → DeepSeek API for severity assessment
4. Storage in MongoDB with transcription model

## Key Implementation Details

### Security Middleware Stack (server/server.js)
- Helmet for security headers
- CORS configuration for cross-origin requests
- Express-rate-limit for API throttling
- Express-mongo-sanitize for NoSQL injection prevention
- HPP for parameter pollution protection
- JWT validation for protected routes

### File Upload Handling
- Multer middleware for file uploads
- Supported formats: PDF, images (PNG, JPG)
- Processing pipeline includes OCR and AI analysis

### Environment Variables
Required in `.env`:
- `MONGO_URL` - Main MongoDB connection
- `AUTH_DB_URL` - Authentication database
- Various API keys for external services (Twilio, DeepSeek, etc.)
- `SESSION_SECRET` - Express session secret

### Testing
- Playwright E2E tests in `/tests/` directory
- Configured for Chromium, Firefox, and WebKit
- No unit test framework currently configured

## Development Notes

### When Adding New Features
1. Check existing patterns in similar components/controllers
2. Follow the established MongoDB model structure
3. Use the existing authentication middleware for protected routes
4. Maintain separation between different database contexts

### When Modifying Authentication
- Auth logic is in `server/app/` directory
- User model includes role-based permissions
- JWT tokens are validated via middleware

### When Working with Real-time Features
- Socket.IO events are handled in `server/server-socket.js`
- Client socket connection in `client/src/client-socket.js`
- Use existing socket patterns for new real-time features

### API Development
- Add new routes to `server/api.js` or appropriate route files
- Use existing validation and error handling patterns
- Protected routes require `verifyToken` middleware

## Common Pitfalls to Avoid

1. Don't modify core framework files listed in README.md's "don't touch" section
2. Ensure all MongoDB connections are properly closed on shutdown
3. Use the established proxy setup - don't make direct localhost:3000 calls from frontend
4. Always use environment variables for sensitive configuration
5. Maintain separate database contexts - don't mix auth data with application data