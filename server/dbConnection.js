const mongoose = require("mongoose");

const mongoConnectionURL =
  process.env.MONGO_URI ||
  "mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const faxDb = mongoose.createConnection(mongoConnectionURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "fax-database",
});

const chatDb = mongoose.createConnection(mongoConnectionURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "chat-database",
});

const patientDb = mongoose.createConnection(mongoConnectionURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "patient-database",
});

const catDb = mongoose.createConnection(mongoConnectionURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "cat-database",
});

// Log connection success
faxDb.on("connected", () => console.log("✅ [db] fax-database connected"));
chatDb.on("connected", () => console.log("✅ [db] chat-database connected"));
patientDb.on("connected", () => console.log("✅ [db] patient-database connected"));
catDb.on("connected", () => console.log("✅ [db] cat-database connected"));

module.exports = {
  faxDb,
  chatDb,
  patientDb,
  catDb,
};