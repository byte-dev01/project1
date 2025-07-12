/*
|--------------------------------------------------------------------------
| server.js -- The core of your server
|--------------------------------------------------------------------------
|
| This file defines how your server starts up. Think of it as the main() of your server.
| At a high level, this file does the following things:
| - Connect to the database
| - Sets up server middleware (i.e. addons that enable things like json parsing, user login)
| - Hooks up all the backend routes specified in api.js
| - Fowards frontend routes that should be handled by the React router
| - Sets up error handling in case something goes wrong when handling a request
| - Actually starts the webserver
*/

// validator runs some basic checks to make sure you've set everything up correctly
// this is a tool provided by staff, so you don't need to worry about it
const validator = require("./validator");
validator.checkSetup();
require("dotenv").config();

//import libraries needed for the webserver to work!
const http = require("http");
const bodyParser = require("body-parser"); // allow node to automatically parse POST body requests as JSON
const express = require("express"); // backend framework for our node server.
const session = require("express-session"); // library that stores info about each connected user
const mongoose = require("mongoose"); // library to connect to MongoDB
const path = require("path"); // provide utilities for working with file and directory paths
const cors = require("cors");
const helmet = require('helmet');
const MongoStore = require('connect-mongo'); // Add this import
const mongoSanitize = require('express-mongo-sanitize');
const authDbUrl = process.env.AUTH_DB_URL
const authDb = require("./app/bezkoder"); // Your bezkoder auth database
const authConfig = require("./app/config/auth.config");
const dbConfig = require("./app/config/db.config");



//1. Express App setup
const app = express();


//1.5
// Register shutdown handlers ONCE at startup
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);  // Also handle Ctrl+C

async function gracefulShutdown() {
  logger.info('Shutdown signal received, closing gracefully...');
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close all database connections
  try {
    await Promise.all([
      authDb.mongoose.connection.close(),
      faxDb.close(),
      chatDb.close(),
      patientDb.close(),
      eventDB.close()
    ]);
    logger.info('All database connections closed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
}

// Then your waitForDatabaseConnections becomes simpler:
const waitForDatabaseConnections = () => {
  const connections = [faxDb, catDb, chatDb, patientDb, eventDB];
  const connectionPromises = connections.map(conn => {
    if (conn.readyState === 1) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      conn.once('connected', resolve);
    });
  });
  
  return Promise.all(connectionPromises);  // Just return the promise
};



// 2. Logger setup



const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
  
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Replace console.log with logger
logger.info('Server starting...');

// Better error handler
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id
  });

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'An error occurred' 
    : err.message;

  res.status(err.status || 500).json({
    status: 'error',
    message
  });
});

//Request Timing
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});





// 4. Security middleware (helmet, cors, rate limiting)

const hpp = require('hpp');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Prevent NoSQL injection attacks
app.use(mongoSanitize());

// Prevent parameter pollution
app.use(hpp());

// Set security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Security middleware

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

//Rate Limiter

const rateLimit = require('express-rate-limit');

// General rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many login attempts, please try again later"
});

// Different limits for different endpoints
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // More attempts for signup
  message: "Too many signup attempts, please try again later",
  skipSuccessfulRequests: true  // Don't count successful requests
});

const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again later",
  skipFailedRequests: false  // Count failed attempts
});

// Apply them separately
app.use('/api/auth/signup', signupLimiter);
app.use('/api/auth/signin', signinLimiter);

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);


// 5. Body parsing and request limits

// set up bodyParser, which allows us to process POST requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(validator.checkRoutes);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: false }));


// 6. Session configuration

// set up a session, which will persist login data across requests
app.use(
  session({
    secret: authConfig.sessionSecret || "session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: dbConfig.url,
      touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);





// 7. Database connections

const api = require("./api");
const auth = require("./auth");
const { faxDb, catDb, chatDb, patientDb, eventDB } = require("./dbConnection");

// socket stuff
const socketManager = require("./server-socket");




// Connect to MongoDB for authentication (bezkoder_db)
authDb.mongoose
  .connect(authDbUrl)
  .then(() => {
    console.log("✅ Successfully connected to Auth MongoDB (bezkoder_db)");
    initializeDatabase();
  })
  .catch(err => {
    logger.error("❌ Auth database connection failed", {
      code: err.code,
      name: err.name,
      // NOT err.message which might contain the URI
    });
  });



// Initialize roles in database
// Initialize database with roles and sample clinic
async function initializeDatabase() {
  try {
    const Role = authDb.role;
    const Clinic = authDb.clinic;
    
    // Initialize roles
    const count = await Role.estimatedDocumentCount();
    
    if (count === 0) {
      // Create all 5 roles
      const roles = ["user", "staff", "moderator", "doctor", "admin"];
      
      for (const roleName of roles) {
        const role = new Role({ name: roleName });
        await role.save();
        console.log(`✅ Added '${roleName}' to roles collection`);
      }
    }
    
    // Initialize a sample clinic (optional)
    const clinicCount = await Clinic.estimatedDocumentCount();
    if (clinicCount === 0) {
      const sampleClinic = new Clinic({
        name: "Main Medical Center",
        address: {
          street: "123 Health St",
          city: "Los Angeles",
          state: "CA",
          zip: "90001"
        },
        phone: "(767) 123-4567",
        email: "info@mainmedical.com"
      });
      await sampleClinic.save();
      console.log("✅ Added sample clinic");
    }
  } catch (error) {
    console.log("Error in database initialization:", error);
  }
}


// 8. Authentication middleware
// Auth middleware - this populates req.user from JWT token or session
// this checks if the user is logged in, and populates "req.user"
app.use(auth.populateCurrentUser);



// Auth routes (from your bezkoder auth system)
require('./app/routes/auth.routes.js')(app);
require('./app/routes/user.routes.js')(app);
require('./app/routes/clinic.routes.js')(app); // New clinic routes


// 9. Health check and monitoring
// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});



// 10. API routes

// connect user-defined routes
app.use("/api", api);

// load the compiled react files, which will serve /index.html and /bundle.js
const reactPath = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(reactPath));

//version of API

// for all other routes, render index.html and let react router handle it
app.use('/api/*', (req, res, next) => {
  if (!req.url.includes('/v1/')) {
    return res.redirect(301, `/api/v1${req.url.replace('/api', '')}`);
  }
  next();
});





app.use('/api/auth/', authLimiter);


// 11. Static file serving

const providerQueues = {
  'dr-hanson': [],
  'dr-chen': [],
  'dr-patel': []
};

// Add patient to queue
app.post('/api/queue', (req, res) => {
  const { providerId, patientId } = req.body;
  
  if (!providerQueues[providerId]) {
    providerQueues[providerId] = [];
  }
  
  // Check if patient already in queue
  const existingIndex = providerQueues[providerId].findIndex(p => p.patientId === patientId);
  
  if (existingIndex === -1) {
    providerQueues[providerId].push({
      patientId,
      joinedAt: new Date(),
      providerId
    });
  }
  
  const position = providerQueues[providerId].findIndex(p => p.patientId === patientId) + 1;
  
  res.json({ position, providerId });
});

// Get queue position
app.get('/api/queue/position', (req, res) => {
  const { patientId } = req.query;
  
  for (const [providerId, queue] of Object.entries(providerQueues)) {
    const position = queue.findIndex(p => p.patientId === patientId) + 1;
    if (position > 0) {
      return res.json({ position, providerId });
    }
  }
  
  res.json({ position: null });
});

// Remove patient from queue (when visit starts)
app.post('/api/queue/remove', (req, res) => {
  const { patientId, providerId } = req.body;
  
  if (providerQueues[providerId]) {
    providerQueues[providerId] = providerQueues[providerId].filter(
      p => p.patientId !== patientId
    );
  }
  
  res.json({ success: true });
});

// Save patient data
app.post('/api/patient-immediatecare', (req, res) => {
  // Save to database
  console.log('Patient data received:', req.body);
  res.json({ success: true });
});

// =====================================
// MongoDB Change Streams
// =====================================

// Corrected setupRealTimeDB function based on your actual Transcription model

const setupRealTimeDB = async () => {
  try {
    console.log("🔄 Setting up MongoDB Change Streams...");
    
    // Wait for all connections to be ready
    const connections = [faxDb, patientDb, eventDB, chatDb, catDb];
    const connectionPromises = connections.map(conn => {
      if (conn.readyState !== 1) {
        return new Promise((resolve) => {
          conn.once('connected', resolve);
        });
      }
      return Promise.resolve();
    });
    
    await Promise.all(connectionPromises);
    console.log("⏳ All database connections ready...");
    
    // 🔥 CORRECT: Watch 'transcriptions' collection in faxDb (from your handleNewFax function)
    if (faxDb.readyState === 1 && faxDb.db) {
      const faxTranscriptionChangeStream = faxDb.db.collection('transcriptions').watch( 
        [], 
        { fullDocument: 'updateLookup' }
      );
      
      faxTranscriptionChangeStream.on('change', (change) => {
        console.log(`📠 Fax transcription ${change.operationType}: ${change.fullDocument?.fileName || 'Unknown file'}`);
        
        // Log severity info for high-priority cases
        if (change.fullDocument?.severityScore >= 7) {
          console.log(`🚨 HIGH SEVERITY: ${change.fullDocument.severityScore}/10 - ${change.fullDocument.severityReason}`);
        }
        
        const io = socketManager.getIo();
        if (io) {
          io.emit("dataChanged", {
            action: "refresh",
            operationType: change.operationType,
            timestamp: new Date(),
            collection: "transcriptions",
            database: "faxDB",
            fileName: change.fullDocument?.fileName,
            severityScore: change.fullDocument?.severityScore,
            severityLevel: change.fullDocument?.severityLevel,
            isHighSeverity: change.fullDocument?.severityScore >= 7
          });
          console.log(`✅ Fax transcription notification sent to all clients (Severity: ${change.fullDocument?.severityScore || 'N/A'})`);
        }
      });
      
      faxTranscriptionChangeStream.on('error', (error) => {
        console.error("❌ Fax Transcription Change Stream error:", error);
        setTimeout(() => {
          console.log("🔁 Attempting to reconnect fax transcription stream...");
          setupRealTimeDB();
        }, 5000);
      });
      
      console.log("✅ Fax transcriptions change stream initialized (watching 'transcriptions' in faxDb)");
    }
    
    // 📅 Watch calendar events in eventDB
    if (eventDB.readyState === 1 && eventDB.db) {
      const eventChangeStream = eventDB.db.collection('events').watch(
        [],
        { fullDocument: 'updateLookup' }
      );
      
      eventChangeStream.on('change', (change) => {
        console.log(`📅 Calendar event ${change.operationType}: ${change.fullDocument?.title || 'Unknown event'}`);
        const io = socketManager.getIo();
        if (io) {
          io.emit("dataChanged", {
            action: "refresh",
            operationType: change.operationType,
            timestamp: new Date(),
            collection: "events",
            database: "eventDB",
            eventTitle: change.fullDocument?.title,
            eventDate: change.fullDocument?.date
          });
        }
      });
      
      console.log("✅ Calendar events change stream initialized");
    }
    
    // 💬 Watch chat messages in chatDb (if needed for real-time chat)
    if (chatDb.readyState === 1 && chatDb.db) {
      const chatChangeStream = chatDb.db.collection('messages').watch(
        [],
        { fullDocument: 'updateLookup' }
      );
      
      chatChangeStream.on('change', (change) => {
        console.log(`💬 Chat message ${change.operationType}`);
        const io = socketManager.getIo();
        if (io) {
          io.emit("dataChanged", {
            action: "refresh",
            operationType: change.operationType,
            timestamp: new Date(),
            collection: "messages",
            database: "chatDB"
          });
        }
      });
      
      console.log("✅ Chat messages change stream initialized");
    }
    
    console.log("✅ All MongoDB Change Streams initialized successfully");
    
  } catch (error) {
    console.error("❌ Failed to setup MongoDB Change Stream:", error);
    console.log("⚠️ Continuing without real-time database updates");
    
    // Retry setup after delay
    setTimeout(() => {
      console.log("🔁 Retrying change stream setup...");
      setupRealTimeDB();
    }, 10000);
  }
};




// hardcode port to 3000 for now
const port = 3000;
const server = http.Server(app);
socketManager.init(server);


// 12. Error handling


app.use((err, req, res, next) => {
  // Log the error properly
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id,
    statusCode: err.status || 500
  });

  // Determine status code
  const status = err.status || 500;
  
  // Send appropriate response
  if (process.env.NODE_ENV === 'production') {
    // Don't leak error details in production
    res.status(status).json({
      status: 'error',
      message: status === 500 ? 'Internal server error' : err.message,
      code: err.code || 'SERVER_ERROR'
    });
  } else {
    // In development, send full error ( Remember Change this Later)
    res.status(status).json({
      status: 'error',
      message: err.message,
      stack: err.stack,
      code: err.code
    });
  }
});


app.get("*", (req, res) => {
  res.sendFile(path.join(reactPath, "index.html"));
});




server.listen(port, async () => {
  console.log(`🚀 Server running on port: ${port}`);
  console.log(`🔐 Auth system ready with 5 roles: user, staff, moderator, doctor, admin`);

  // 等待数据库连接建立
  const waitForDatabaseConnections = () => {
    const connections = [faxDb, catDb, chatDb, patientDb, eventDB];
    const connectionPromises = connections.map(conn => {
      if (conn.readyState === 1) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        conn.once('connected', resolve);
      });
    });
 

    return Promise.all(connectionPromises);
  };

  // Wait for all database connections before setting up change streams
  try {
    await waitForDatabaseConnections();
    console.log("✅ All database connections established");
    
    // Now setup change streams
    await setupRealTimeDB();
  } catch (error) {
    console.error("❌ Error during startup:", error);
  }
});