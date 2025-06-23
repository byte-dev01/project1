
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
const User = require("./models/user");
const Message = require("./models/message");
const multer = require("multer");
const fs = require("fs");
const Tesseract = require("tesseract.js");
const axios = require("axios"); // add at the top
const FormData = require("form-data");
const sql = require("./dbConnection.js");
const handleOCRData = require("./ocr_data"); // 模块化处理OCR逻辑
const handleTranscribeData = require("./controllers/transcribe_data");

// ADD THIS: Import your fax processing function
const handleNewFax = require("./controllers/handleNewFax");

const upload = multer({ dest: "uploads/" });
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"
const router = express.Router();

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

router.post("/login", auth.login);
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
router.post("/fax-upload", upload.single("file"), async (req, res) => {
  console.log("📥 Fax upload endpoint called");
  
  // Check if file was uploaded
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
    console.log(`📁 File path: ${filePath}`);
    
    // Call your handleNewFax function
    const result = await handleNewFax(filePath);
    
    // Clean up uploaded file after processing
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.log("✅ Fax processed successfully");
    res.status(200).json({ 
      status: "success", 
      message: "Fax processed successfully",
      result: result,
      fileName: originalName
    });
    
  } catch (err) {
    console.error("❌ Fax processing failed:", err.message);
    
    // Clean up uploaded file on error
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

// NEW: Get fax processing history
router.get("/fax-history", async (req, res) => {
  try {
    // Import your TranscriptionFax model
    const { faxDb } = require("./dbConnection");
    const createTranscriptionFaxModel = require("./models/TranscriptionFax");
    const TranscriptionFax = createTranscriptionFaxModel(faxDb);
    
    const limit = parseInt(req.query.limit) || 20;
    const faxes = await TranscriptionFax.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('fileName severityScore severityLevel severityReason createdAt');
    
    res.json({
      status: "success",
      faxes: faxes,
      total: faxes.length
    });
    
  } catch (err) {
    console.error("❌ Failed to get fax history:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

// NEW: Get fax processing stats
router.get("/fax-stats", async (req, res) => {
  try {
    const { faxDb } = require("./dbConnection");
    const createTranscriptionFaxModel = require("./models/TranscriptionFax");
    const TranscriptionFax = createTranscriptionFaxModel(faxDb);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get various stats
    const [
      totalProcessed,
      todayProcessed,
      highSeverityToday,
      averageSeverity
    ] = await Promise.all([
      TranscriptionFax.countDocuments(),
      TranscriptionFax.countDocuments({ createdAt: { $gte: today } }),
      TranscriptionFax.countDocuments({ 
        createdAt: { $gte: today },
        severityScore: { $gte: 7 }
      }),
      TranscriptionFax.aggregate([
        { $group: { _id: null, avgSeverity: { $avg: "$severityScore" } } }
      ])
    ]);
    
    res.json({
      status: "success",
      stats: {
        totalProcessed,
        todayProcessed,
        highSeverityToday,
        averageSeverity: averageSeverity[0]?.avgSeverity || 0,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error("❌ Failed to get fax stats:", err.message);
    res.status(500).json({
      status: "error", 
      message: err.message
    });
  }
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;