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

//import libraries needed for the webserver to work!
const http = require("http");
const bodyParser = require("body-parser"); // allow node to automatically parse POST body requests as JSON
const express = require("express"); // backend framework for our node server.
const session = require("express-session"); // library that stores info about each connected user
const mongoose = require("mongoose"); // library to connect to MongoDB
const path = require("path"); // provide utilities for working with file and directory paths

const api = require("./api");
const auth = require("./auth");
const { faxDb, catDb, chatDb, patientDb, eventDB } = require("./dbConnection");

// socket stuff
const socketManager = require("./server-socket");
require('dotenv').config()

// create a new express server
const app = express();
app.use(validator.checkRoutes);

// set up bodyParser, which allows us to process POST requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// set up a session, which will persist login data across requests
app.use(
  session({
    secret: "session-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// this checks if the user is logged in, and populates "req.user"
app.use(auth.populateCurrentUser);

// connect user-defined routes
app.use("/api", api);

// load the compiled react files, which will serve /index.html and /bundle.js
const reactPath = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(reactPath));

// for all other routes, render index.html and let react router handle it
app.get("*", (req, res) => {
  res.sendFile(path.join(reactPath, "index.html"));
});

// any server errors cause this function to run
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) {
    // 500 means Internal Server Error
    console.log("The server errored when processing a request!");
    console.log(err);
  }

  res.status(status);
  res.send({
    status: status,
    message: err.message,
  });
});
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

server.listen(port, async () => {
  console.log(`🚀 Server running on port: ${port}`);
  
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