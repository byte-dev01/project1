# 🚀 NodeCrypt - Correct Setup & Testing Guide

## 📌 Important: This is a Cloudflare Workers Project!

This is **NOT** a traditional Node.js server application. It's designed to run on **Cloudflare Workers** edge computing platform. Here's how to properly build, test, and deploy it:

---

## ✅ Correct Commands for This Project

### 1. Build the Project
```bash
# Build the frontend assets
npm run build
# or
vite build
```

### 2. Development Mode (Local Testing)
```bash
# Run locally with Wrangler dev server
npm run dev
# or
wrangler dev

# This will start a local server at http://localhost:8787
```

### 3. Deploy to Cloudflare
```bash
# Deploy to Cloudflare Workers
npm run deploy
# or
wrangler deploy
```

---

## 🛠️ Complete Setup Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Frontend Assets
```bash
# This creates the dist/ folder with compiled assets
npm run build
```

### Step 3: Test Locally
```bash
# Start local development server
npm run dev

# Open in browser
# http://localhost:8787
```

### Step 4: Run Tests
```bash
# Run the HIPAA tests (these are standalone)
node test-hipaa-medical-chat.js
node test-queue-system.js

# Or use the test runner
node test-runner.js
```

### Step 5: Deploy to Production
```bash
# Login to Cloudflare (if not already logged in)
wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

---

## 📁 Project Structure Explained

```
NodeCrypt/
├── worker/               # Cloudflare Worker backend
│   └── index.js         # Main worker entry point
├── dist/                # Built frontend assets (created by vite build)
├── client/              # Frontend JavaScript modules
│   └── js/
│       ├── HIPAAMedicalChat.js
│       └── queue/
├── src/                 # Source files for Vite
├── wrangler.toml        # Cloudflare Workers configuration
├── vite.config.js       # Vite build configuration
└── package.json         # NPM scripts and dependencies
```

---

## 🔧 Available NPM Scripts

```json
{
  "scripts": {
    "build": "vite build",        // Build frontend assets
    "dev": "wrangler dev",         // Local development server
    "deploy": "wrangler deploy",   // Deploy to Cloudflare
    "publish": "wrangler publish"  // Publish to Cloudflare (legacy)
  }
}
```

---

## 🧪 Testing the System

### Local Testing with Wrangler

1. **Start the development server:**
```bash
wrangler dev
```

2. **Access the application:**
```
http://localhost:8787
```

3. **Test the API endpoints:**
```bash
# Test health check
curl http://localhost:8787/api/health

# Test WebSocket connection
wscat -c ws://localhost:8787/ws
```

### Browser Testing

1. Open `http://localhost:8787` in your browser
2. Open Developer Console (F12)
3. Test the medical chat features:

```javascript
// In browser console at localhost:8787

// Initialize the chat system
const chat = new HIPAAMedicalChat();
await chat.initialize();

// Test encryption
const encrypted = await chat.signalManager.encryptMessage('test', 'Hello');
console.log('Encrypted:', encrypted);

// Test queue (if available)
if (chat.queueManager) {
    await chat.addPatientToQueue('patient1', 'doctor1', 'consultation', 'normal');
}
```

### Unit Tests (Standalone)

```bash
# These tests run independently of Cloudflare Workers
node test-hipaa-medical-chat.js
node test-queue-system.js
```

---

## 🌩️ Cloudflare Workers Specifics

### Environment Variables
Set these in your Cloudflare dashboard or `.dev.vars` file:

```env
# .dev.vars (for local development)
ENCRYPTION_KEY=your-256-bit-key
JWT_SECRET=your-jwt-secret
ENVIRONMENT=development
```

### Durable Objects
This project uses Durable Objects for real-time features:
- `CHAT_ROOM`: Manages chat room state

### KV Namespaces (if needed)
```bash
# Create KV namespace
wrangler kv:namespace create "MEDICAL_DATA"

# Add to wrangler.toml
[[kv_namespaces]]
binding = "MEDICAL_DATA"
id = "your-namespace-id"
```

---

## 🐞 Debugging

### View Logs
```bash
# Tail production logs
wrangler tail

# View dev server logs
# (They appear in the terminal where you ran 'wrangler dev')
```

### Common Issues & Solutions

#### Issue: "Cannot find module" errors
```bash
# Solution: This is a Workers project, not Node.js
# Use wrangler dev instead of node server.js
wrangler dev
```

#### Issue: "Build failed"
```bash
# Solution: Build assets first
vite build
# Then run dev server
wrangler dev
```

#### Issue: "Authentication required"
```bash
# Solution: Login to Cloudflare
wrangler login
```

---

## 🚀 Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Build frontend
npm run build

# 3. Start local dev server
npm run dev

# 4. Open browser
# http://localhost:8787

# 5. When ready, deploy
npm run deploy
```

---

## 📊 What's Actually Working

### ✅ Working Features:
- Cloudflare Workers deployment
- Vite build system
- WebSocket support via Durable Objects
- End-to-end encryption modules
- HIPAA compliance modules

### ⚠️ Note About Server Files:
The `server/` directory files (hipaa-server.js, queue-server.js) are **examples** for a traditional Node.js deployment. This project actually runs on Cloudflare Workers using:
- `worker/index.js` - Main worker logic
- `wrangler.toml` - Configuration
- Durable Objects for real-time features

---

## 🎯 Next Steps

1. **For Development**: Use `wrangler dev`
2. **For Production**: Use `wrangler deploy`
3. **For Testing**: Run standalone test files
4. **For Monitoring**: Use `wrangler tail` for logs

The project is configured correctly for Cloudflare Workers! 🎉

---

*This is a Cloudflare Workers edge application, not a traditional Node.js server application. Use Wrangler commands for development and deployment.*