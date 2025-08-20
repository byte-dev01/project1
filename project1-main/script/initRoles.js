// Create completeRoleInit.js
const mongoose = require('mongoose');

async function initializeAllRoles() {
  try {
    // Use proper connection options
    await mongoose.connect('mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/bezkoder_db?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🔧 Initializing ALL required roles...\n');
    
    // Define the Role schema (since we're in a standalone script)
    const roleSchema = new mongoose.Schema({
      name: String
    });
    const Role = mongoose.model('Role', roleSchema);
    
    // All 6 required roles
    const requiredRoles = [
      'user',
      'staff', 
      'doctor',
      'moderator',
      'admin',
      'clinic_admin'
    ];
    
    console.log('📋 Current roles in database:');
    const existingRoles = await Role.find({});
    existingRoles.forEach(role => {
      console.log(`  ✅ ${role.name} (ID: ${role._id})`);
    });
    
    console.log('\n🔄 Adding missing roles:');
    for (const roleName of requiredRoles) {
      const existingRole = await Role.findOne({ name: roleName });
      if (!existingRole) {
        const newRole = new Role({ name: roleName });
        await newRole.save();
        console.log(`  ✅ Created role: ${roleName} (ID: ${newRole._id})`);
      } else {
        console.log(`  ⏭️  Role already exists: ${roleName}`);
      }
    }
    
    console.log('\n📊 Final roles count:');
    const finalRoles = await Role.find({});
    console.log(`Total roles: ${finalRoles.length}`);
    finalRoles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role._id})`);
    });
    
    console.log('\n🎉 Role initialization complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

initializeAllRoles();