// Create createAdminDirect.js - direct database method
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    await mongoose.connect('mongodb+srv://rachellipurdue2:FPD8clZuvOXwOUrm@cluster0.br34aun.mongodb.net/bezkoder_db?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🔧 Creating admin user directly in database...\n');
    
    // Define schemas
    const roleSchema = new mongoose.Schema({ name: String });
    const Role = mongoose.model('Role', roleSchema);
    
    const userSchema = new mongoose.Schema({
      username: String,
      email: String,
      password: String,
      name: String,
      clinicId: { type: mongoose.Schema.Types.ObjectId },
      roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now }
    });
    const User = mongoose.model('User', userSchema);
    
    // Get required roles
    const adminRole = await Role.findOne({ name: 'admin' });
    const doctorRole = await Role.findOne({ name: 'doctor' });
    const staffRole = await Role.findOne({ name: 'staff' });
    
    if (!adminRole || !doctorRole || !staffRole) {
      console.log('❌ Required roles not found. Run completeRoleInit.js first');
      process.exit(1);
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ username: 'SuperAdmin' });
    if (existingUser) {
      console.log('⏭️ SuperAdmin already exists, updating roles...');
      existingUser.roles = [adminRole._id, doctorRole._id, staffRole._id];
      await existingUser.save();
      console.log('✅ Updated existing SuperAdmin user');
    } else {
      // Create new admin user
      const hashedPassword = bcrypt.hashSync('Password01!', 12);
      
      const adminUser = new User({
        username: 'SuperAdmin',
        email: 'admin@healthbridge.com',
        password: hashedPassword,
        name: 'Super Administrator',
        clinicId: new mongoose.Types.ObjectId('687210715b2d0f7e909a7df4'),
        roles: [adminRole._id, doctorRole._id, staffRole._id],
        isActive: true
      });
      
      await adminUser.save();
      console.log('✅ Created new SuperAdmin user');
    }
    
    // Verify the user
    console.log('\n📊 Verification:');
    const verifyUser = await User.findOne({ username: 'SuperAdmin' }).populate('roles', 'name');
    if (verifyUser) {
      console.log(`✅ Username: ${verifyUser.username}`);
      console.log(`✅ Email: ${verifyUser.email}`);
      console.log(`✅ Roles: [${verifyUser.roles.map(r => r.name).join(', ')}]`);
      console.log(`✅ Active: ${verifyUser.isActive}`);
      console.log(`✅ Clinic ID: ${verifyUser.clinicId}`);
    }
    
    console.log('\n🎉 Admin user creation complete!');
    console.log('📝 Login credentials:');
    console.log('   Username: SuperAdmin');
    console.log('   Password: Password01!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminUser();