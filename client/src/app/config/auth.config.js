const crypto = require('crypto');

module.exports = {
  // Generate a strong, random secret (do this once, then use environment variable)
  secret: process.env.JWT_SECRET || "tomatosaucew/sugar",
  
  // JWT options for better security
  jwtOptions: {
    algorithm: 'HS256',
    expiresIn: '12h', // Shorter expiration
    issuer: 'your-app-name',
    audience: 'your-app-users'
  },
  
  // Refresh token settings
  refreshTokenExpiry: '7d', // Refresh tokens last 7 days
  
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true, 
    requireNumbers: true,
    requireSpecialChars: true
  }
};