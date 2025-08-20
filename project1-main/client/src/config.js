const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://healthbridge.railway.app'  // Railway URL
    : 'http://localhost:3000'
};

export default config;
