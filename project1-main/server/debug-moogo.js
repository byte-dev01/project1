// debug-connection.js
// Run this script to find where the connection string is coming from

const mongoose = require("mongoose");
require('dotenv').config();

// 1. Check environment variables
console.log("=== CHECKING ENVIRONMENT VARIABLES ===");
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("MONGODB_URI:", process.env.MONGODB_URI);
console.log("DATABASE_URL:", process.env.DATABASE_URL);

// 2. Check all env vars that might contain mongo
console.log("\n=== ALL ENV VARS WITH 'MONGO' ===");
Object.keys(process.env).forEach(key => {
  if (key.toLowerCase().includes('mongo') || 
      key.toLowerCase().includes('database') ||
      (process.env[key] && process.env[key].includes && process.env[key].includes('mongodb'))) {
    console.log(`${key}:`, process.env[key]);
  }
});

// 3. Check .env file if using dotenv
try {
  require('dotenv').config();
  console.log("\n=== AFTER LOADING .env ===");
  console.log("MONGO_URI:", process.env.MONGO_URI);
} catch (e) {
  console.log("\n=== No .env file or dotenv not installed ===");
}

// 4. Test connection with trace
console.log("\n=== TESTING CONNECTION WITH TRACE ===");
mongoose.set('debug', true); // Enable mongoose debugging

const testConnection = async () => {
  try {
    const mongoConnectionURL = process.env.MONGO_URI || 
      "mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    
    console.log("Using connection string:", mongoConnectionURL);
    
    const conn = await mongoose.createConnection(mongoConnectionURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "test-database",
    });

    console.log("Connection successful!");
    await conn.close();
  } catch (error) {
    console.error("Connection error:", error);
  }
};

testConnection();

// 5. Check if there are any config files
console.log("\n=== CHECKING FOR CONFIG FILES ===");
const fs = require('fs');
const path = require('path');

const configFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  'config.js',
  'config.json',
  'database.js',
  'db.config.js',
];

configFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Found: ${file}`);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('mongodb://')) {
        console.log(`  ⚠️  Contains mongodb:// URL!`);
        // Show the line containing mongodb://
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('mongodb://')) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    } catch (e) {
      console.log(`  Could not read: ${e.message}`);
    }
  }
});

// 6. Check package.json for any scripts
console.log("\n=== CHECKING package.json SCRIPTS ===");
try {
  const packageJson = require('./package.json');
  if (packageJson.scripts) {
    Object.entries(packageJson.scripts).forEach(([name, script]) => {
      if (script.includes('mongodb')) {
        console.log(`Script "${name}": ${script}`);
      }
    });
  }
} catch (e) {
  console.log("Could not read package.json");
}
