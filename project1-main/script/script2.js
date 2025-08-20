const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

async function debugUsersAndClinics() {
  console.log('🔍 Debugging Users and Clinics...\n');

  try {
    // Get all clinics
    console.log('1. Fetching all clinics...');
    const clinicsResponse = await axios.get(`${BASE_URL}/api/clinics`);
    console.log('📋 Available clinics:');
    clinicsResponse.data.forEach(clinic => {
      console.log(`   - ${clinic.name} (ID: ${clinic._id})`);
    });

    // Test TestUser1 without clinic requirement
    console.log('\n2. Testing TestUser1 signin without clinic...');
    try {
      const signinData = {
        username: 'TestUser1',
        password: 'Password01!'
        // No clinicId to see if user exists at all
      };

      const userResponse = await axios.post(`${BASE_URL}/api/auth/signin`, signinData);
      console.log('✅ TestUser1 exists! Details:');
      console.log('   - User ID:', userResponse.data.id || userResponse.data.user?.id);
      console.log('   - Username:', userResponse.data.username || userResponse.data.user?.username);
      console.log('   - Clinic ID:', userResponse.data.clinicId || userResponse.data.user?.clinicId);
      console.log('   - Clinic Name:', userResponse.data.clinicName || userResponse.data.user?.clinicName);
      
    } catch (userError) {
      console.log('❌ TestUser1 signin failed:', userError.response?.data?.message || userError.message);
    }

    // Test TestUser8 for comparison
    console.log('\n3. Testing TestUser8 signin without clinic...');
    try {
      const signinData8 = {
        username: 'TestUser8',
        password: 'Password01!'
      };

      const user8Response = await axios.post(`${BASE_URL}/api/auth/signin`, signinData8);
      console.log('✅ TestUser8 exists! Details:');
      console.log('   - User ID:', user8Response.data.id || user8Response.data.user?.id);
      console.log('   - Username:', user8Response.data.username || user8Response.data.user?.username);
      console.log('   - Clinic ID:', user8Response.data.clinicId || user8Response.data.user?.clinicId);
      console.log('   - Clinic Name:', user8Response.data.clinicName || user8Response.data.user?.clinicName);
      
    } catch (user8Error) {
      console.log('❌ TestUser8 signin failed:', user8Error.response?.data?.message || user8Error.message);
    }

    console.log('\n💡 Recommendation: Use the user that has the matching clinicId for your tests');

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

// Run the debug
debugUsersAndClinics();