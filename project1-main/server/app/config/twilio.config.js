const twilio = require('twilio');

// Initialize Twilio client
let twilioClient = null;

if (process.env.TWILIO_ENABLED === 'true') {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
    console.log('Twilio client initialized successfully');
  } else {
    console.warn('Twilio credentials not configured. SMS functionality will be disabled.');
  }
} else {
  console.info('Twilio disabled. Using console logging for SMS codes.');
}

module.exports = twilioClient || {
  messages: {
    create: async (options) => {
      console.log('SMS Mock:', options);
      return { sid: 'mock-message-id' };
    }
  }
};