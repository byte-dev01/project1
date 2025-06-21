require('dotenv').config();
const postgres = require('postgres');

// Create and configure the SQL connection for Supabase Transaction Mode
const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 6543, // Transaction mode port
  database: process.env.DB_NAME || 'postgres',
  username: process.env.DB_USER || 'your_username',
  password: process.env.DB_PASSWORD || 'your_password',
  // Critical settings for Supabase Transaction Mode
  prepare: false, // REQUIRED: Transaction mode does not support prepared statements
  ssl: 'require', // Supabase requires SSL
  pool_mode: 'transaction', // REQUIRED: Specify transaction pooling mode
  transform: {
    undefined: null // Handle undefined values
  },
  connection: {
    options: '--search_path=public' // Set default schema
  },
  // Additional transaction mode optimizations
  idle_timeout: 0,
  max_lifetime: 0
});

// Export the sql function
module.exports = sql;