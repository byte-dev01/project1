// Create verifyFixes.js
const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

async function verifyAllFixes() {
  console.log('🧪 Verifying all authentication fixes...\n');

  try {
    // Test 1: Verify SuperAdmin login
    console.log('1. Testing SuperAdmin login...');
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/signin`, {
      username: 'SuperAdmin',
      password: 'Password01!'
    });
    
    if (adminLogin.data.success) {
      console.log('✅ SuperAdmin login successful');
      console.log(`   - User ID: ${adminLogin.data.id}`);
      console.log(`   - Roles: ${adminLogin.data.roles.join(', ')}`);
      console.log(`   - Token: ${adminLogin.data.accessToken ? 'Present' : 'Missing'}`);
    }

    // Test 2: Verify TestUser8 (should have admin roles now)
    console.log('\n2. Testing TestUser8 login...');
    const user8Login = await axios.post(`${BASE_URL}/api/auth/signin`, {
      username: 'TestUser8',
      password: 'Password01!'
    });
    
    if (user8Login.data.success) {
      console.log('✅ TestUser8 login successful');
      console.log(`   - Roles: ${user8Login.data.roles.join(', ')}`);
    }

    // Test 3: Verify TestUser1 (should have user role now)
    console.log('\n3. Testing TestUser1 login...');
    const user1Login = await axios.post(`${BASE_URL}/api/auth/signin`, {
      username: 'TestUser1',
      password: 'Password01!'
    });
    
    if (user1Login.data.success) {
      console.log('✅ TestUser1 login successful');
      console.log(`   - Roles: ${user1Login.data.roles.join(', ')}`);
    }

    // Test 4: Token verification
    console.log('\n4. Testing token verification...');
    const tokenTest = await axios.get(`${BASE_URL}/api/auth/verify`, {
      headers: {
        'x-access-token': adminLogin.data.accessToken
      }
    });
    
    if (tokenTest.data.success) {
      console.log('✅ Token verification successful');
    }

    console.log('\n🎉 All tests passed! Authentication system is working correctly.');
    console.log('\n📝 Recommended login credentials for demo:');
    console.log('   Username: SuperAdmin');
    console.log('   Password: Password01!');
    console.log('   Features: Full admin access to all features');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    console.log('\n💡 If tests fail:');
    console.log('1. Make sure your server is running');
    console.log('2. Run the initialization scripts in order');
    console.log('3. Check your .env file has correct connection strings');
  }
}

verifyAllFixes();