const mongoose = require("mongoose");

module.exports = (conn) => {
  const MessageSchema = new mongoose.Schema({
    sender: {
      _id: String,
      name: String,
    },
    recipient: {
      _id: String,
      name: String,
    },
    timestamp: { type: Date, default: Date.now },
    content: String,
  });

  return conn.model("Message", MessageSchema);
};
