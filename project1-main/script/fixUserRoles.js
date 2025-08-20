// Create fixAllUsers.js
const mongoose = require('mongoose');

async function fixAllUserRoles() {
  try {
    await mongoose.connect('mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/bezkoder_db?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🔧 Fixing all user role assignments...\n');
    
    // Define schemas for standalone script
    const roleSchema = new mongoose.Schema({ name: String });
    const Role = mongoose.model('Role', roleSchema);
    
    const userSchema = new mongoose.Schema({
      username: String,
      email: String,
      name: String,
      roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }]
    });
    const User = mongoose.model('User', userSchema);
    
    // Get all roles
    const allRoles = await Role.find({});
    console.log('📋 Available roles:');
    const roleMap = {};
    allRoles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role._id})`);
      roleMap[role.name] = role._id;
    });
    
    // Define user role assignments
    const userRoleAssignments = {
      'TestUser1': ['user'],
      'TestUser8': ['admin', 'doctor'],
      'Test777': ['admin', 'doctor'],
      'TestUser777': ['admin', 'doctor']
    };
    
    console.log('\n👥 Fixing user roles:');
    
    for (const [username, roleNames] of Object.entries(userRoleAssignments)) {
      try {
        const user = await User.findOne({ username });
        if (user) {
          // Get role IDs
          const roleIds = roleNames.map(roleName => roleMap[roleName]).filter(Boolean);
          
          if (roleIds.length > 0) {
            user.roles = roleIds;
            await user.save();
            console.log(`  ✅ ${username}: assigned roles [${roleNames.join(', ')}]`);
          } else {
            console.log(`  ❌ ${username}: no valid roles found for [${roleNames.join(', ')}]`);
          }
        } else {
          console.log(`  ⏭️  ${username}: user not found`);
        }
      } catch (error) {
        console.log(`  ❌ ${username}: error - ${error.message}`);
      }
    }
    
    // Verify assignments
    console.log('\n📊 Verification - User roles after fix:');
    for (const username of Object.keys(userRoleAssignments)) {
      try {
        const user = await User.findOne({ username }).populate('roles', 'name');
        if (user) {
          const roles = user.roles.map(r => r.name);
          console.log(`  - ${username}: [${roles.join(', ')}] (${roles.length} roles)`);
        }
      } catch (error) {
        console.log(`  - ${username}: verification failed`);
      }
    }
    
    console.log('\n🎉 User role assignment complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAllUserRoles();