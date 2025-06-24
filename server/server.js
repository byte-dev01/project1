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

// socket stuff
const socketManager = require("./server-socket");
require('dotenv').config()

// Import your fax-related modules
const { faxDb } = require("./dbConnection"); // Your fax database connection
const TranscriptionFax = require("./models/TranscriptionFax")(faxDb);
const sendTwilioAlert = require("./services/twilio"); // Your Twilio service

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

// =====================================
// FAX DASHBOARD API ROUTES
// =====================================

// Get fax records for dashboard
app.get("/api/fax-records", async (req, res) => {
  try {
    const { timeRange } = req.query;
    let dateFilter = {};
    
    // Calculate date filter based on time range
    const now = new Date();
    switch(timeRange) {
      case '1h':
        dateFilter = { processedAt: { $gte: new Date(now - 60 * 60 * 1000) } };
        break;
      case '24h':
        dateFilter = { processedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { processedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { processedAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = { processedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    }

    const faxData = await TranscriptionFax.find(dateFilter)
      .sort({ processedAt: -1 })
      .limit(1000); // Limit to prevent overwhelming the UI

    res.json({ 
      success: true,
      faxData: faxData || []
    });
  } catch (error) {
    console.error("Error fetching fax records:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch fax records",
      faxData: []
    });
  }
});

// Get dashboard statistics
app.get("/api/fax-stats", async (req, res) => {
  try {
    const { timeRange } = req.query;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate date filter for the selected time range
    let dateFilter = {};
    switch(timeRange) {
      case '1h':
        dateFilter = { processedAt: { $gte: new Date(now - 60 * 60 * 1000) } };
        break;
      case '24h':
        dateFilter = { processedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { processedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { processedAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = { processedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    }

    // Calculate statistics
    const [
      totalProcessed,
      todayProcessed,
      highSeverityCount,
      allRecords
    ] = await Promise.all([
      TranscriptionFax.countDocuments(dateFilter),
      TranscriptionFax.countDocuments({ 
        processedAt: { $gte: todayStart } 
      }),
      TranscriptionFax.countDocuments({ 
        ...dateFilter,
        severityScore: { $gte: 7 }
      }),
      TranscriptionFax.find(dateFilter, { processedAt: 1 }).sort({ processedAt: 1 })
    ]);

    // Calculate average processing time (simplified - you can enhance this)
    let averageProcessingTime = 5.2; // Default value
    if (allRecords.length > 1) {
      const times = allRecords.map(record => new Date(record.processedAt));
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push((times[i] - times[i-1]) / 1000); // Convert to seconds
      }
      if (intervals.length > 0) {
        averageProcessingTime = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        averageProcessingTime = Math.round(averageProcessingTime * 10) / 10; // Round to 1 decimal
      }
    }

    const stats = {
      totalProcessed,
      todayProcessed,
      highSeverityCount,
      averageProcessingTime,
      systemStatus: "Running" // You can make this dynamic based on your system status
    };

    res.json({ 
      success: true,
      stats 
    });
  } catch (error) {
    console.error("Error calculating fax stats:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to calculate statistics",
      stats: {
        totalProcessed: 0,
        todayProcessed: 0,
        highSeverityCount: 0,
        averageProcessingTime: 0,
        systemStatus: "Error"
      }
    });
  }
});

// Send Twilio alert
app.post("/api/send-twilio-alert", async (req, res) => {
  try {
    const { phoneNumber, message, faxId } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: "Phone number and message are required" 
      });
    }

    // Send the alert using your existing Twilio function
    await sendTwilioAlert(message);
    
    // Optionally, log the alert in your database
    if (faxId) {
      await TranscriptionFax.findByIdAndUpdate(faxId, {
        $push: { 
          alerts: { 
            phoneNumber, 
            message, 
            sentAt: new Date() 
          } 
        }
      });
    }

    res.json({ 
      success: true, 
      message: "Alert sent successfully" 
    });
  } catch (error) {
    console.error("Error sending Twilio alert:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to send alert: " + error.message 
    });
  }
});

// System health check endpoint
app.get("/api/system-status", async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    
    // Check recent activity (files processed in last hour)
    const recentActivity = await TranscriptionFax.countDocuments({
      processedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      status: {
        database: dbStatus,
        recentActivity,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error checking system status:", error);
    res.status(500).json({ 
      success: false, 
      error: "System status check failed" 
    });
  }
});

// =====================================
// END FAX DASHBOARD API ROUTES
// =====================================

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

// hardcode port to 3000 for now
const port = 3000;
const server = http.Server(app);
socketManager.init(server);

server.listen(port, () => {
  console.log(`Server running on port: ${port}`);
  console.log(`📠 Fax Dashboard API endpoints ready`);
});

module.exports = app;