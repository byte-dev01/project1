import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export class SecureAPIClient {
  private static instance: AxiosInstance;
  
  /**
   * Create secure API client with HTTPS enforcement
   */
  static initialize(baseURL: string): void {
    // ENFORCE HTTPS - Critical for HIPAA
    if (!baseURL.startsWith('https://')) {
      throw new Error('API must use HTTPS for HIPAA compliance');
    }
    
    this.instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add security headers
    this.instance.interceptors.request.use(
      async (config) => {
        // Check network is secure (not public WiFi)
        await this.checkNetworkSecurity();
        
        // Add auth token if exists
        const token = await this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add security headers
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        config.headers['X-Content-Type-Options'] = 'nosniff';
        config.headers['X-Frame-Options'] = 'DENY';
        
        // Log for audit (without sensitive data)
        console.log(`Secure API Request: ${config.method?.toUpperCase()} ${config.url}`);
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    // Handle responses
    this.instance.interceptors.response.use(
      (response) => {
        // Verify response is from HTTPS
        if (response.request?.url && !response.request.url.startsWith('https://')) {
          console.error('WARNING: Non-HTTPS response detected');
        }
        return response;
      },
      async (error) => {
        // Handle SSL/TLS errors
        if (error.code === 'ENOTFOUND' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          console.error('SSL/TLS Error:', error.message);
          throw new Error('Secure connection failed. Please check your network.');
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Check if network is secure enough for PHI
   */
  private static async checkNetworkSecurity(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    
    // Warn about insecure networks
    if (netInfo.type === 'wifi' && !netInfo.details?.isConnectionExpensive) {
      // This is likely public WiFi
      console.warn('WARNING: Potentially insecure network detected');
      // In production, you might want to show a warning to the user
    }
  }
  
  /**
   * Make secure GET request
   */
  static async get(url: string, config?: AxiosRequestConfig): Promise<any> {
    const response = await this.instance.get(url, config);
    return response.data;
  }
  
  /**
   * Make secure POST request
   */
  static async post(url: string, data: any, config?: AxiosRequestConfig): Promise<any> {
    const response = await this.instance.post(url, data, config);
    return response.data;
  }
  
  /**
   * Make secure PUT request
   */
  static async put(url: string, data: any, config?: AxiosRequestConfig): Promise<any> {
    const response = await this.instance.put(url, data, config);
    return response.data;
  }
  
  /**
   * Make secure DELETE request
   */
  static async delete(url: string, config?: AxiosRequestConfig): Promise<any> {
    const response = await this.instance.delete(url, config);
    return response.data;
  }
  
  private static async getAuthToken(): Promise<string | null> {
    // Get from secure storage
    return await SecureStorageService.getSecureItem('auth_token');
  }
}

// Initialize on app start
SecureAPIClient.initialize('https://api.healthbridge.com');

// Usage in your app:
const fetchPrescriptions = async (patientId: string) => {
  try {
    // This will ONLY work over HTTPS
    const prescriptions = await SecureAPIClient.get(
      `/patients/${patientId}/prescriptions`
    );
    
    // Store encrypted locally
    await SecureStorageService.setSecureItem(
      `prescriptions_${patientId}`,
      prescriptions
    );
    
    return prescriptions;
  } catch (error) {
    console.error('Failed to fetch prescriptions securely:', error);
    throw error;
  }
};
