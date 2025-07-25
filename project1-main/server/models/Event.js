const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true, // Ensure each event has a unique ID
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: String, // Format: "YYYY-MM-DD"
    required: true,
  },
  startTime: {
    type: String, // Format: "HH:MM" (24-hour)
    required: true,
  },
  endTime: {
    type: String, // Format: "HH:MM" (24-hour)
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  location: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for better query performance
EventSchema.index({ date: 1, startTime: 1 });
EventSchema.index({ id: 1 });

// Factory function to create Event model with a specific connection
const createEventModel = (connection) => {
  return connection.model("Event", EventSchema);
};

module.exports = createEventModel;