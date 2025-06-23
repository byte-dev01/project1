const mongoose = require("mongoose");

const TranscriptionSchema = new mongoose.Schema({
  transcription: { type: String, required: true },
  summary: { type: String },
  createdAt: { type: Date, default: Date.now },
  patientId: req.body.patientId || null, // if available
});

module.exports = (connection) => connection.model("Transcription", TranscriptionSchema);
