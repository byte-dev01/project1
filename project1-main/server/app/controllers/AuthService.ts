
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import TouchID from 'react-native-touch-id';
import JailMonkey from 'jail-monkey';
import NetInfo from '@react-native-community/netinfo';
import CryptoJS from 'crypto-js';
import { Platform, Alert } from 'react-native';

/**
 * Healthcare-compliant Authentication Service
 * Works with your existing JWT backend
 */
export class AuthService {
  private static instance: AuthService;
  private baseURL: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  // Healthcare-specific settings
  private readonly SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes (HIPAA requirement)
  private readonly KEYCHAIN_SERVICE = 'com.healthbridge.auth';
  private lastActivity: Date = new Date();

  private constructor() {
    this.baseURL = process.env.API_BASE_URL || 'https://api.healthbridge.com';
    this.initializeSecurityChecks();
    this.startSessionMonitor();
  }

  static getInstance(): AuthService {
    if (!this.instance) {
      this.instance = new AuthService();
    }
    return this.instance;
  }

  /**
   * Initialize security checks for healthcare compliance
   */
  private async initializeSecurityChecks(): Promise<void> {
    // Check for jailbreak/root (required for healthcare)
    if (JailMonkey.isJailBroken()) {
      Alert.alert(
        '⚠️ Security Warning',
        'This device appears to be jailbroken/rooted. For your security, HealthBridge cannot run on compromised devices.',
        [{ text: 'OK', onPress: () => this.logout() }]
      );
      throw new Error('Device is jailbroken/rooted');
    }

    // Check for debugger (prevent reverse engineering)
    if (JailMonkey.isDebuggedMode()) {
      throw new Error('Debugger detected');
    }
  }

  /**
   * Sign up - Uses your existing endpoint
   */
  async signup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    role: 'patient' | 'provider';
    licenseNumber?: string; // For providers
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Validate password strength for healthcare
      if (!this.isPasswordSecure(data.password)) {
        return {
          success: false,
          error: 'Password must be at least 12 characters with uppercase, lowercase, number, and special character',
        };
      }

      // Add device information for audit trail
      const deviceInfo = await this.getDeviceInfo();

      const response = await fetch(`${this.baseURL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceInfo.deviceId,
          'X-Platform': Platform.OS,
          'X-App-Version': DeviceInfo.getVersion(),
        },
        body: JSON.stringify({
          ...data,
          deviceInfo, // Send device info for security tracking
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.message || 'Signup failed',
        };
      }

      // Store tokens securely
      await this.storeTokensSecurely(result.token, result.refreshToken);

      // Enable biometric authentication
      await this.setupBiometrics();

      return {
        success: true,
        user: result.user,
      };

    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Login - Uses your existing endpoint with mobile enhancements
   */
  async login(data: {
    email: string;
    password: string;
    useBiometric?: boolean;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return {
          success: false,
          error: 'No internet connection',
        };
      }

      // Option 1: Biometric login (if previously setup)
      if (data.useBiometric) {
        const biometricAuth = await this.authenticateWithBiometric();
        if (!biometricAuth.success) {
          return biometricAuth;
        }
        // Use stored credentials
        const credentials = await this.getStoredCredentials();
        if (!credentials) {
          return {
            success: false,
            error: 'No stored credentials. Please login with password.',
          };
        }
        data.email = credentials.username;
        data.password = credentials.password;
      }

      const deviceInfo = await this.getDeviceInfo();

      // Call your existing login endpoint
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceInfo.deviceId,
          'X-Platform': Platform.OS,
          'X-App-Version': DeviceInfo.getVersion(),
          'X-Device-Name': deviceInfo.deviceName,
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          deviceInfo,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 423) {
          return {
            success: false,
            error: 'Account locked due to multiple failed attempts. Please contact support.',
          };
        }
        return {
          success: false,
          error: result.message || 'Login failed',
        };
      }

      // Store tokens securely
      await this.storeTokensSecurely(result.token, result.refreshToken);

      // Store user info
      await this.storeUserInfo(result.user);

      // Reset activity timer
      this.lastActivity = new Date();

      return {
        success: true,
        user: result.user,
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed. Please check your credentials.',
      };
    }
  }

  /**
   * Make authenticated API calls
   */
  async authenticatedFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Check session timeout
    if (this.isSessionExpired()) {
      await this.refreshSession();
    }

    // Get current token
    const token = await this.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    // Update activity
    this.lastActivity = new Date();

    // Add auth headers
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'X-Device-Id': await this.getDeviceId(),
      'X-Platform': Platform.OS,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle token refresh
    if (response.status === 401) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        // Retry with new token
        const newToken = await this.getToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        return fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }

    return response;
  }

  /**
   * Refresh JWT token
   */
  private async refreshSession(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const result = await response.json();
        await this.storeTokensSecurely(result.token, result.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Store tokens securely in iOS Keychain
   */
  private async storeTokensSecurely(
    token: string,
    refreshToken?: string
  ): Promise<void> {
    // Parse token to get expiry
    const payload = this.parseJWT(token);
    this.tokenExpiry = new Date(payload.exp * 1000);

    // Store in memory for quick access
    this.token = token;
    this.refreshToken = refreshToken || null;

    // Store in Keychain for persistence
    await Keychain.setInternetCredentials(
      this.KEYCHAIN_SERVICE,
      'token',
      token,
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        authenticatePrompt: 'Authenticate to access your medical records',
      }
    );

    if (refreshToken) {
      await Keychain.setInternetCredentials(
        `${this.KEYCHAIN_SERVICE}_refresh`,
        'refreshToken',
        refreshToken,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );
    }
  }

  /**
   * Get token from secure storage
   */
  private async getToken(): Promise<string | null> {
    // Check memory first
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    // Retrieve from Keychain
    try {
      const credentials = await Keychain.getInternetCredentials(this.KEYCHAIN_SERVICE);
      if (credentials) {
        this.token = credentials.password;
        return this.token;
      }
    } catch (error) {
      console.error('Failed to retrieve token:', error);
    }

    return null;
  }

  /**
   * Get refresh token from secure storage
   */
  private async getRefreshToken(): Promise<string | null> {
    if (this.refreshToken) {
      return this.refreshToken;
    }

    try {
      const credentials = await Keychain.getInternetCredentials(
        `${this.KEYCHAIN_SERVICE}_refresh`
      );
      if (credentials) {
        this.refreshToken = credentials.password;
        return this.refreshToken;
      }
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
    }

    return null;
  }

  /**
   * Setup biometric authentication
   */
  private async setupBiometrics(): Promise<void> {
    try {
      const biometryType = await TouchID.isSupported();
      
      if (biometryType) {
        Alert.alert(
          'Enable Biometric Login',
          'Would you like to use Face ID/Touch ID for faster, secure login?',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                // Store encrypted credentials for biometric login
                const credentials = await Keychain.getInternetCredentials(this.KEYCHAIN_SERVICE);
                if (credentials) {
                  await Keychain.setInternetCredentials(
                    `${this.KEYCHAIN_SERVICE}_biometric`,
                    credentials.username,
                    credentials.password,
                    {
                      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                      authenticatePrompt: 'Authenticate to enable biometric login',
                      authenticationPromptBiometry: biometryType,
                    }
                  );
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.log('Biometric setup not available');
    }
  }

  /**
   * Authenticate with biometric
   */
  async authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const reason = 'Authenticate to access your medical records';
      const auth = await TouchID.authenticate(reason, {
        title: 'Biometric Authentication',
        fallbackLabel: 'Use Password',
        passcodeFallback: false,
      });

      if (auth) {
        return { success: true };
      }

      return {
        success: false,
        error: 'Biometric authentication failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint
      const token = await this.getToken();
      if (token) {
        await fetch(`${this.baseURL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear tokens
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;

    // Clear Keychain
    await Keychain.resetInternetCredentials(this.KEYCHAIN_SERVICE);
    await Keychain.resetInternetCredentials(`${this.KEYCHAIN_SERVICE}_refresh`);
    await Keychain.resetInternetCredentials(`${this.KEYCHAIN_SERVICE}_biometric`);

    // Clear user info
    await Keychain.resetInternetCredentials(`${this.KEYCHAIN_SERVICE}_user`);
  }

  /**
   * Session timeout monitor
   */
  private startSessionMonitor(): void {
    setInterval(() => {
      const now = new Date();
      const timeSinceActivity = now.getTime() - this.lastActivity.getTime();
      
      if (timeSinceActivity > this.SESSION_TIMEOUT) {
        Alert.alert(
          'Session Expired',
          'Your session has expired for security. Please login again.',
          [{ text: 'OK', onPress: () => this.logout() }]
        );
      }
    }, 60000); // Check every minute
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(): boolean {
    const now = new Date();
    const timeSinceActivity = now.getTime() - this.lastActivity.getTime();
    return timeSinceActivity > this.SESSION_TIMEOUT;
  }

  /**
   * Helper: Parse JWT token
   */
  private parseJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to parse JWT:', error);
      return {};
    }
  }

  /**
   * Helper: Check password strength for healthcare
   */
  private isPasswordSecure(password: string): boolean {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  /**
   * Helper: Get device information
   */
  private async getDeviceInfo(): Promise<any> {
    return {
      deviceId: await DeviceInfo.getUniqueId(),
      deviceName: await DeviceInfo.getDeviceName(),
      brand: DeviceInfo.getBrand(),
      model: DeviceInfo.getModel(),
      systemVersion: DeviceInfo.getSystemVersion(),
      appVersion: DeviceInfo.getVersion(),
      buildNumber: DeviceInfo.getBuildNumber(),
      isTablet: DeviceInfo.isTablet(),
      hasNotch: DeviceInfo.hasNotch(),
    };
  }

  /**
   * Helper: Get device ID
   */
  private async getDeviceId(): Promise<string> {
    return DeviceInfo.getUniqueId();
  }

  /**
   * Helper: Store user info
   */
  private async storeUserInfo(user: any): Promise<void> {
    const userString = JSON.stringify(user);
    const encrypted = CryptoJS.AES.encrypt(userString, await this.getDeviceId()).toString();
    
    await Keychain.setInternetCredentials(
      `${this.KEYCHAIN_SERVICE}_user`,
      'user',
      encrypted,
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );
  }

  /**
   * Helper: Get stored credentials (for biometric login)
   */
  private async getStoredCredentials(): Promise<{ username: string; password: string } | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(
        `${this.KEYCHAIN_SERVICE}_biometric`
      );
      if (credentials) {
        return {
          username: credentials.username,
          password: credentials.password,
        };
      }
    } catch (error) {
      console.error('Failed to get stored credentials:', error);
    }
    return null;
  }
}

// ============================================
// USAGE IN YOUR APP
// ============================================

import { AuthService } from './services/AuthService';

const auth = AuthService.getInstance();

// Signup
const handleSignup = async () => {
  const result = await auth.signup({
    email: 'user@example.com',
    password: 'SecureP@ssw0rd123!',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    role: 'patient',
  });

  if (result.success) {
    // Navigate to home
    navigation.navigate('Home');
  } else {
    Alert.alert('Signup Failed', result.error);
  }
};

// Login
const handleLogin = async () => {
  const result = await auth.login({
    email: 'user@example.com',
    password: 'SecureP@ssw0rd123!',
    useBiometric: false,
  });

  if (result.success) {
    navigation.navigate('Home');
  } else {
    Alert.alert('Login Failed', result.error);
  }
};

// Make authenticated API calls
const fetchPatientData = async () => {
  try {
    const response = await auth.authenticatedFetch('/api/patients/me');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch patient data:', error);
  }
};

// Logout
const handleLogout = async () => {
  await auth.logout();
  navigation.navigate('Login');
};