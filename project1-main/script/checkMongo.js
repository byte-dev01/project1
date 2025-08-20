// Create checkMongo.js - run this when you get connection errors
const mongoose = require('mongoose');

const testConnection = async () => {
  console.log('🔍 Testing MongoDB connection...\n');
  
  const connectionString = "mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  
  try {
    const connection = await mongoose.createConnection(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    
    console.log('✅ MongoDB connection successful!');
    console.log('🔗 Connection state:', connection.readyState);
    console.log('🗄️ Database name:', connection.db.databaseName);
    
    await connection.close();
    console.log('📴 Connection closed gracefully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 DNS Resolution Error - Possible fixes:');
      console.log('1. Check your internet connection');
      console.log('2. Try using a VPN if your ISP blocks MongoDB Atlas');
      console.log('3. Check if your IP is whitelisted in MongoDB Atlas');
      console.log('4. Wait a few minutes and try again');
    }
    
    if (error.message.includes('authentication failed')) {
      console.log('\n💡 Authentication Error - Check:');
      console.log('1. Username and password are correct');
      console.log('2. User has proper database permissions');
    }
  }
  
  process.exit(0);
};

testConnection();