const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

async function createTestUsers() {
  await mongoose.connect('mongodb://localhost:27017/your-db-name');
  
  // 创建测试用户
  const testUsers = [
    {
      username: 'dr.smith',
      email: 'smith@clinic.com',
      password: bcrypt.hashSync('Test123!', 8),
      clinicName: '市中心诊所',
      userType: 'doctor'
    },
    {
      username: 'dr.jones',
      email: 'jones@clinic.com',
      password: bcrypt.hashSync('Test123!', 8),
      clinicName: '西区健康中心',
      userType: 'doctor'
    },
    {
      username: 'patient1',
      email: 'patient1@email.com',
      password: bcrypt.hashSync('Test123!', 8),
      clinicName: '市中心诊所',
      userType: 'patient'
    }
  ];
  
  for (const userData of testUsers) {
    const existingUser = await User.findOne({ username: userData.username });
    if (!existingUser) {
      await User.create(userData);
      console.log(`✅ Created user: ${userData.username}`);
    } else {
      console.log(`⏭️  User already exists: ${userData.username}`);
    }
  }
  
  console.log('✅ Test users created!');
  process.exit(0);
}

createTestUsers().catch(console.error);