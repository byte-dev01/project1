// models/Transcription.js (for fax database)
const mongoose = require("mongoose");

const TranscriptionSchema = new mongoose.Schema({
  transcription: { type: String, required: true },
  summary: { type: String },
  severityScore: { type: Number },
  severityLevel: { type: String },
  severityReason: { type: String },
  fileName: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Export a function that creates the model with a specific connection
module.exports = (connection) => connection.model("Transcription", TranscriptionSchema);
