// Create checkUserRoles.js to debug the database
const mongoose = require('mongoose');
const User = require('../server/app/models/user.model');
const Role = require('../server/app/models/role.model');

async function checkUserRoles() {
  try {
    await mongoose.connect('mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/bezkoder_db?retryWrites=true&w=majority&appName=Cluster0');
    
    console.log('🔍 Checking Test777 user and roles...\n');
    
    // Check if roles exist in database
    console.log('📋 Available roles in database:');
    const allRoles = await Role.find({});
    allRoles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role._id})`);
    });
    
    // Check Test777 user
    console.log('\n👤 Test777 user details:');
    const user = await User.findOne({ username: 'Test777' })
      .populate('roles', 'name')
      .populate('clinicId', 'name');
    
    if (user) {
      console.log('✅ User found:');
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Roles array length: ${user.roles.length}`);
      console.log(`  Roles:`, user.roles.map(r => r.name));
      console.log(`  Raw roles array:`, user.roles);
      console.log(`  Clinic: ${user.clinicId?.name || 'None'}`);
    } else {
      console.log('❌ User not found');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserRoles();