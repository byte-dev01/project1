// iOS App generates temporary auth code
class CrossPlatformAuth {
  // On iOS: Generate secure transition
  async generateWebLoginCode(): Promise<string> {
    const code = crypto.randomUUID();
    const expires = Date.now() + 60000; // 1 minute
    
    // Store temporarily with current auth
    await api.post('/auth/generate-web-code', {
      code,
      expires,
      currentToken: this.token,
      deviceId: this.deviceId,
    });
    
    // Display as QR code
    return `https://app.healthbridge.com/auth/mobile-login?code=${code}`;
  }
}

// Web: Scan QR or enter code
const loginWithMobileCode = async (code: string) => {
  const response = await fetch('/auth/verify-mobile-code', {
    method: 'POST',
    body: JSON.stringify({ 
      code,
      webDeviceFingerprint: getWebFingerprint(),
    }),
  });
  
  const { webToken } = await response.json();
  // New token specifically for web session
  localStorage.setItem('token', webToken);
};