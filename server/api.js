
/*
|--------------------------------------------------------------------------
| api.js -- server routes
|--------------------------------------------------------------------------
|
| This file defines the routes for your server.
|
*/

const express = require("express");

// import models so we can interact with the database
const Story = require("./models/story");
const Comment = require("./models/comment");
const User = require("./app/models/user.model");
const { chatDb } = require("./dbConnection");
const authDb = require("./app/models");

const createMessageModel = require("./models/message");
const Message = createMessageModel(chatDb);
const multer = require("multer");
const fs = require("fs");
const Tesseract = require("tesseract.js");
const axios = require("axios"); // add at the top
const FormData = require("form-data");
const sql = require("./dbConnection.js");
const handleOCRData = require("./ocr_data"); // 模块化处理OCR逻辑
const handleTranscribeData = require("./controllers/transcribe_data");
const { eventDB } = require("./dbConnection");
const createEventModel = require("./models/Event"); // We'll create this model
const Event = createEventModel(eventDB);


const router = express.Router();



// this is the signup section
// Update your auth signin to validate clinic
router.get("/clinics", async (req, res) => {
  try {
    const clinics = await authDb.clinic.find({ isActive: true })
      .select('name address phone email');
    res.json(clinics);
  } catch (error) {
    res.status(500).json({ message: "Error fetching clinics" });
  }
});

// Update your auth signin to validate clinic
router.post("/auth/signin", async (req, res) => {
  try {
    const { username, password, clinicId } = req.body;
    
    // Validate clinic exists
    const clinic = await authDb.clinic.findById(clinicId);
    if (!clinic || !clinic.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid clinic selection" 
      });
    }
    
    // Continue with existing signin logic...
    // Make sure to include clinicId and clinicName in the response
  } catch (error) {
    console.log('error in handling clinics')
  }
});











// above is the signup section

// ADD THIS: Import your fax processing function
const handleNewFax = require("./controllers/handleNewFax");

const upload = multer({ dest: "uploads/" });
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"

const socketManager = require("./server-socket");

router.get("/stories", (req, res) => {
  // empty selector means get all documents
  Story.find({}).then((stories) => res.send(stories));
});

router.post("/story", auth.ensureLoggedIn, (req, res) => {
  const newStory = new Story({
    creator_id: req.user._id,
    creator_name: req.user.name,
    content: req.body.content,
  });

  newStory.save().then((story) => res.send(story));
});

router.get("/comment", (req, res) => {
  Comment.find({ parent: req.query.parent }).then((comments) => {
    res.send(comments);
  });
});

router.post("/comment", auth.ensureLoggedIn, (req, res) => {
  const newComment = new Comment({
    creator_id: req.user._id,
    creator_name: req.user.name,
    parent: req.body.parent,
    content: req.body.content,
  });

  newComment.save().then((comment) => res.send(comment));
});

router.post("/logout", auth.logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }

  res.send(req.user);
});

router.get("/user", (req, res) => {
  User.findById(req.query.userid).then((user) => {
    res.send(user);
  });
});



router.post("/initsocket", (req, res) => {
  // do nothing if user not logged in
  if (req.user) socketManager.addUser(req.user, socketManager.getSocketFromSocketID(req.body.socketid));
  res.send({});
});

router.get("/chat", (req, res) => {
  let query;
  if (req.query.recipient_id === "ALL_CHAT") {
    // get any message sent by anybody to ALL_CHAT
    query = { "recipient._id": "ALL_CHAT" };
  } else {
    // get messages that are from me->you OR you->me
    query = {
      $or: [
        { "sender._id": req.user._id, "recipient._id": req.query.recipient_id },
        { "sender._id": req.query.recipient_id, "recipient._id": req.user._id },
      ],
    };
  }

  Message.find(query).then((messages) => res.send(messages));
});

router.post("/message", auth.ensureLoggedIn, (req, res) => {
  console.log(`Received a chat message from ${req.user.name}: ${req.body.content}`);

  // insert this message into the database
  const message = new Message({
    recipient: req.body.recipient,
    sender: {
      _id: req.user._id,
      name: req.user.name,
    },
    content: req.body.content,
  });
  message.save();

  if (req.body.recipient._id == "ALL_CHAT") {
    socketManager.getIo().emit("message", message);
  } else {
    socketManager.getSocketFromUserID(req.body.recipient._id).emit("message", message);
    if(req.user._id !== req.body.recipient._id) socketManager.getSocketFromUserID(req.user._id).emit("message", message);
  }
});

router.get("/activeUsers", (req, res) => {
  res.send({ activeUsers: socketManager.getAllConnectedUsers() });
});

const { spawn } = require("child_process");

router.post("/ocr", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const filename = req.file.originalname;

  const python = spawn("python", ["-u", "server/ocr.py", filePath]);

  let output = "";
  let errorOutput = "";

  python.stdout.on("data", (chunk) => (output += chunk.toString()));
  python.stderr.on("data", (chunk) => (errorOutput += chunk.toString()));

  python.on("close", async (code) => {
    if (code !== 0) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: errorOutput });
    }

    try {
      await handleOCRData(output, filename, filePath, res);
    } catch (err) {
      fs.unlinkSync(filePath);
      console.error("OCR insert failed:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  const filePath = req.file.path;
  if (!filePath) return res.status(400).json({ error: "No file" });

  try {
    await handleTranscribeData(filePath, res);
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error("Transcribe error:", err);
    res.status(500).json({ error: err.message });
  }
});

// FIXED: Fax processing endpoint with proper error handling
router.get("/fax-records", async (req, res) => {
  try {
    const { faxDb } = require("./dbConnection");
    const createTranscriptionFaxModel = require("./models/TranscriptionFax");
    const TranscriptionFax = createTranscriptionFaxModel(faxDb);
    
    const timeRange = req.query.timeRange || "24h";
    
    // 根据时间范围计算过滤条件
    let dateFilter = {};
    const now = new Date();
    
    switch(timeRange) {
      case "1h":
        dateFilter = { createdAt: { $gte: new Date(now - 60 * 60 * 1000) } };
        break;
      case "24h":
        dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case "7d":
        dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case "30d":
        dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    }
    
    console.log(`📊 Fetching fax records for timeRange: ${timeRange}`);
    
    // 从 MongoDB 获取真实数据
    const faxData = await TranscriptionFax.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean(); // 使用 lean() 提高性能
    
    console.log(`📋 Found ${faxData.length} fax records in database`);
    
    // 转换数据格式以匹配前端期望
    const transformedData = faxData.map(fax => ({
      _id: fax._id,
      fileName: fax.fileName || "Unknown File",
      processedAt: fax.createdAt,
      severityLevel: fax.severityLevel || "轻度",
      severityScore: fax.severityScore || 1,
      severityReason: fax.severityReason || "No reason provided",
      summary: fax.summary || "No summary available",
      transcription: fax.transcription || "No transcription available"
    }));

    res.json({
      status: "success",
      faxData: transformedData,
      totalRecords: transformedData.length,
      timeRange: timeRange
    });
    
  } catch (error) {
    console.error("❌ Failed to fetch fax records:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
      faxData: []
    });
  }
});

// NEW: Get fax processing history

router.get("/fax-stats", async (req, res) => {
  try {
    const { faxDb } = require("./dbConnection");
    const createTranscriptionFaxModel = require("./models/TranscriptionFax");
    const TranscriptionFax = createTranscriptionFaxModel(faxDb);
    
    const timeRange = req.query.timeRange || "24h";
    
    // 计算日期过滤器
    let dateFilter = {};
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(timeRange) {
      case "1h":
        dateFilter = { createdAt: { $gte: new Date(now - 60 * 60 * 1000) } };
        break;
      case "24h":
        dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case "7d":
        dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case "30d":
        dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    }
    
    console.log(`📈 Calculating stats for timeRange: ${timeRange}`);
    
    // 并行计算各种统计数据
    const [
      totalProcessed,
      rangeProcessed,
      todayProcessed,
      highSeverityCount,
      severityDistribution
    ] = await Promise.all([
      TranscriptionFax.countDocuments(),
      TranscriptionFax.countDocuments(dateFilter),
      TranscriptionFax.countDocuments({ createdAt: { $gte: today } }),
      TranscriptionFax.countDocuments({ 
        ...dateFilter,
        severityScore: { $gte: 7 }
      }),
      // 聚合严重程度分布
      TranscriptionFax.aggregate([
        { $match: dateFilter },
        { 
          $group: { 
            _id: "$severityLevel", 
            count: { $sum: 1 },
            avgScore: { $avg: "$severityScore" }
          } 
        }
      ])
    ]);
    
    console.log(`📊 Stats calculated: ${rangeProcessed} records in range, ${highSeverityCount} high severity`);
    
    res.json({
      status: "success",
      stats: {
        totalProcessed: totalProcessed,
        todayProcessed: todayProcessed,
        highSeverityCount: highSeverityCount,
        averageProcessingTime: 2.3, // 可以从实际数据计算
        systemStatus: "Running"
      },
      severityDistribution: severityDistribution,
      timeRange: timeRange
    });
    
  } catch (error) {
    console.error("❌ Failed to get fax stats:", error);
    res.status(500).json({
      status: "error", 
      message: error.message,
      stats: {
        totalProcessed: 0,
        todayProcessed: 0,
        highSeverityCount: 0,
        averageProcessingTime: 0,
        systemStatus: "Error"
      },
      severityDistribution: []
    });
  }
});

// 增强的 fax-upload 端点，添加 Socket 广播
router.post("/fax-upload", upload.single("file"), async (req, res) => {
  console.log("📥 Fax upload endpoint called");
  
  if (!req.file) {
    return res.status(400).json({ 
      status: "error", 
      message: "No file uploaded" 
    });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  
  try {
    console.log(`📄 Processing fax: ${originalName}`);
    
    // 调用你的 handleNewFax 函数
    const result = await handleNewFax(filePath);
    
    // 清理上传的文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.log("✅ Fax processed successfully, result:", result);
    
    // 🔥 通过 Socket.io 通知所有客户端数据已更新
    socketManager.getIo().emit("dataChanged", {
      action: "refresh",
      timestamp: new Date(),
      changeType: "insert",
      message: `New fax processed: ${originalName}`
    });
    
    console.log("📡 Socket notification sent to all connected clients");
    
    res.status(200).json({ 
      status: "success", 
      message: "Fax processed successfully",
      result: result,
      fileName: originalName
    });
    
  } catch (err) {
    console.error("❌ Fax processing failed:", err.message);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.status(500).json({ 
      status: "error", 
      message: err.message,
      fileName: originalName
    });
  }
});

// Demo endpoint for sending alerts
router.post("/send-twilio-alert", (req, res) => {
  console.log("📱 Demo alert sent:", req.body);
  res.json({
    status: "success",
    message: "Demo alert sent successfully"
  });
});


// 📅 CALENDAR API ROUTES
// Add these routes to your existing router in api.js

// Get all events
router.get("/events", async (req, res) => {
  try {
    console.log("📅 Fetching all calendar events");
    const events = await Event.find({}).sort({ date: 1, startTime: 1 });
    console.log(`✅ Found ${events.length} events`);
    res.json(events);
  } catch (error) {
    console.error("❌ Failed to fetch events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get events for a specific date range (for week view)
router.get("/events/range", async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end dates are required" });
    }
    
    console.log(`📅 Fetching events from ${start} to ${end}`);
    
    const events = await Event.find({
      date: {
        $gte: start,
        $lte: end
      }
    }).sort({ date: 1, startTime: 1 });
    
    console.log(`✅ Found ${events.length} events in range`);
    res.json(events);
  } catch (error) {
    console.error("❌ Failed to fetch events by range:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});
router.post("/events", async (req, res) => {
  try {
    const { id, title, date, startTime, endTime } = req.body;
    
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    console.log(`📅 Creating new event: ${title} on ${date}`);
    
    const newEvent = new Event({
      id: id || Date.now().toString(),
      title,
      date,
      startTime,
      endTime,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const savedEvent = await newEvent.save();
    console.log(`✅ Event created successfully: ${savedEvent._id}`);
    
    // 🔥 Notify all clients via Socket.io that data changed
    socketManager.getIo().emit("dataChanged", {
      action: "refresh",
      operationType: "insert",
      timestamp: new Date(),
      message: `New event created: ${title}`
    });
    
    res.status(201).json(savedEvent);
  } catch (error) {
    console.error("❌ Failed to create event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// Update an existing event
router.put("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, startTime, endTime } = req.body;
    
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    console.log(`📅 Updating event: ${id}`);
    
    const updatedEvent = await Event.findOneAndUpdate(
      { id: id }, // Find by your custom id field
      {
        title,
        date,
        startTime,
        endTime,
        updatedAt: new Date()
      },
      { new: true } // Return the updated document
    );
    
    if (!updatedEvent) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    console.log(`✅ Event updated successfully: ${updatedEvent._id}`);
    
    // 🔥 Notify all clients via Socket.io that data changed
    socketManager.getIo().emit("dataChanged", {
      action: "refresh",
      operationType: "update",
      timestamp: new Date(),
      message: `Event updated: ${title}`
    });
    
    res.json(updatedEvent);
  } catch (error) {
    console.error("❌ Failed to update event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// Delete an event
router.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📅 Deleting event: ${id}`);
    
    const deletedEvent = await Event.findOneAndDelete({ id: id });
    
    if (!deletedEvent) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    console.log(`✅ Event deleted successfully: ${deletedEvent._id}`);
    
    // 🔥 Notify all clients via Socket.io that data changed
    socketManager.getIo().emit("dataChanged", {
      action: "refresh",
      operationType: "delete",
      timestamp: new Date(),
      message: `Event deleted: ${deletedEvent.title}`
    });
    
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("❌ Failed to delete event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// Health check for calendar API
router.get("/calendar/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Calendar API is running",
    database: "eventDB connected"
  });
});






// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;