const mongoose = require("mongoose");

const TranscriptionSchema = new mongoose.Schema({
  transcription: { type: String, required: true },
  summary: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transcription", TranscriptionSchema);
