const mongoose = require("mongoose");
const { catDb } = require("../dbConnection"); // Import the specific database

const UserSchema = new mongoose.Schema({
  name: String,
  googleid: String,
});

module.exports = catDb.model("User", UserSchema); // ← Use catDb instead of default
