const config = {
  API_URL: process.env.REACT_APP_API_URL || (
    process.env.NODE_ENV === 'production' 
      ? 'https://healthbridge.railway.app'
      : 'http://localhost:3000'
  ),
  WS_URL: process.env.REACT_APP_WS_URL || (
    process.env.NODE_ENV === 'production' 
      ? 'wss://healthbridge.railway.app'  // WebSocket Secure for production
      : 'http://localhost:3000'
  )
};

export default config;
