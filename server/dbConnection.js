const mongoose = require("mongoose");

const mongoConnectionURL =
  process.env.MONGO_SRV;

// Minimal connection options - just the essentials
const baseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

// Helper function to reduce repetition
const createConnection = (dbName) => {
  const connection = mongoose.createConnection(mongoConnectionURL, {
    ...baseOptions,
    dbName: dbName,
  });

  // Connection event handlers
  connection.on("connected", () => {
    console.log(`✅ [db] ${dbName} connected`);
  });

  connection.on("error", (err) => {
    console.error(`❌ [db] ${dbName} connection error:`, err);
  });

  connection.on("disconnected", () => {
    console.warn(`⚠️ [db] ${dbName} disconnected`);
  });

  return connection;
};

// Create your connections
const faxDb = createConnection("fax-database");
const chatDb = createConnection("chat-database");
const patientDb = createConnection("patient-database");
const catDb = createConnection("cat-database");
const eventDB = createConnection("event-database");


module.exports = {
  faxDb,
  chatDb,
  patientDb,
  catDb, //userDB
  eventDB,
  mongoConnectionURL,
};