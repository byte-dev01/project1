// server/models/Transcription.js
const mongoose = require("mongoose");

const TranscriptionSchema = new mongoose.Schema({
  transcription: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: false
  },
  severityScore: {
    type: Number,
    required: false,
    min: 1,
    max: 10
  },
  severityLevel: {
    type: String,
    required: false,
    enum: ['轻度', '中度', '重度', '危急']
  },
  severityReason: {
    type: String,
    required: false
  },
  fileName: {
    type: String,
    required: true
  },
  patientId: {
    type: String,
    required: false,
    default: null  // Remove the req.body reference - this was the error!
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  alerts: [{
    phoneNumber: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Add indexes for better performance
TranscriptionSchema.index({ processedAt: -1 });
TranscriptionSchema.index({ severityScore: -1 });
TranscriptionSchema.index({ fileName: 1 });

// Export function that creates model with specific connection
module.exports = (connection) => {
  return connection.model('Transcription', TranscriptionSchema);
};