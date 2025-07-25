const mongoose = require("mongoose");

const Clinic = mongoose.model(
  "Clinic",
  new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String
    },
    phone: String,
    email: String,
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  })
);

module.exports = Clinic;

