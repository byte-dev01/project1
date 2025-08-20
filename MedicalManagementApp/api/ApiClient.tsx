import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG, AUTH_CONFIG } from '../utils/constants';
import { securityManager } from '../src/services/security';
import { getErrorMessage } from '../utils/helpers';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing: boolean = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      async (config) => {
        // Add auth token
        const token = await SecureStore.getItemAsync(AUTH_CONFIG.TOKEN_KEY);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add correlation ID for tracking
        config.headers['X-Correlation-ID'] = this.generateCorrelationId();

        // Log request for debugging (remove in production)
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(() => {
              return this.instance(originalRequest);
            }).catch((err) => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = await SecureStore.getItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY);
            if (refreshToken) {
              const { authAPI } = await import('./auth');
              const response = await authAPI.refreshToken(refreshToken);
              
              await SecureStore.setItemAsync(AUTH_CONFIG.TOKEN_KEY, response.token);
              await SecureStore.setItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY, response.refreshToken);

              this.processQueue(null);
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            this.processQueue(refreshError);
            // Redirect to login
            await this.handleAuthError();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Handle other errors
        return this.handleError(error);
      }
    );
  }

  private processQueue(error: any) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve();
      }
    });
    this.failedQueue = [];
  }

  private async handleAuthError() {
    await SecureStore.deleteItemAsync(AUTH_CONFIG.TOKEN_KEY);
    await SecureStore.deleteItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY);
    // Navigation will be handled by auth store
  }

  private handleError(error: AxiosError) {
    const message = getErrorMessage(error);
    
    // Log security events for certain errors
    if (error.response?.status === 403) {
      securityManager.logSecurityEvent({
        type: 'FORBIDDEN_ACCESS',
        details: { url: error.config?.url, method: error.config?.method }
      });
    }

    // Show user-friendly error messages
    if (error.response) {
      switch (error.response.status) {
        case 400:
          Alert.alert('Invalid Request', message);
          break;
        case 403:
          Alert.alert('Access Denied', 'You do not have permission to perform this action.');
          break;
        case 404:
          Alert.alert('Not Found', 'The requested resource was not found.');
          break;
        case 500:
          Alert.alert('Server Error', 'Something went wrong. Please try again later.');
          break;
        default:
          Alert.alert('Error', message);
      }
    } else if (error.request) {
      Alert.alert('Network Error', 'Please check your internet connection.');
    }

    return Promise.reject(error);
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods
  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config);
  }

  post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config);
  }

  put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config);
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config);
  }

  request<T>(config: AxiosRequestConfig) {
    return this.instance.request<T>(config);
  }
}

export const apiClient = new ApiClient();
export const api = apiClient; // Alias for backward compatibility


export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/auth/signin',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    WHOAMI: '/api/whoami',
  },
  
  // Clinics
  CLINICS: {
    LIST: '/api/clinics',
    DETAIL: (id: string) => `/api/clinics/${id}`,
  },
  
  // Patients
  PATIENTS: {
    LIST: '/api/patients',
    SEARCH: '/api/patients/search',
    DETAIL: (id: string) => `/api/patients/${id}`,
    CREATE: '/api/patients',
    UPDATE: (id: string) => `/api/patients/${id}`,
    RECORDS: (id: string) => `/api/patients/${id}/records`,
    MEDICATIONS: (id: string) => `/api/patients/${id}/medications`,
  },
  
  // Fax
  FAX: {
    LIST: '/api/fax-records',
    STATS: '/api/fax-stats',
    DETAIL: (id: string) => `/api/fax/${id}`,
    UPDATE_STATUS: (id: string) => `/api/fax/${id}/status`,
    ASSIGN: (id: string) => `/api/fax/${id}/assign`,
  },
  
  // Insurance
  INSURANCE: {
    PREFILL: '/api/insurance/prefill',
    VERIFY: '/api/insurance/verify',
    SUBMIT: '/api/insurance/submit',
    PROVIDERS: '/api/insurance/providers',
    ESTIMATE: '/api/insurance/estimate',
  },
  
  // Messages
  MESSAGES: {
    LIST: '/api/messages',
    SEND: '/api/messages/send',
    DETAIL: (id: string) => `/api/messages/${id}`,
    MARK_READ: (id: string) => `/api/messages/${id}/read`,
    ARCHIVE: (id: string) => `/api/messages/${id}/archive`,
    THREADS: '/api/messages/threads',
  },
  
  // OCR
  OCR: {
    UPLOAD: '/api/ocr/upload',
    STATUS: (id: string) => `/api/ocr/status/${id}`,
    PROCESS: '/api/ocr/process',
  },
  
  // Appointments
  APPOINTMENTS: {
    LIST: '/api/appointments',
    CREATE: '/api/appointments',
    DETAIL: (id: string) => `/api/appointments/${id}`,
    UPDATE: (id: string) => `/api/appointments/${id}`,
    CANCEL: (id: string) => `/api/appointments/${id}/cancel`,
    SLOTS: '/api/appointments/slots',
  },
  
  // Providers
  PROVIDERS: {
    LIST: '/api/providers',
    DETAIL: (id: string) => `/api/providers/${id}`,
    SCHEDULE: (id: string) => `/api/providers/${id}/schedule`,
  },
  
  // Files
  FILES: {
    UPLOAD: '/api/files/upload',
    DOWNLOAD: (id: string) => `/api/files/${id}/download`,
    DELETE: (id: string) => `/api/files/${id}`,
  },
  
  // Audit
  AUDIT: {
    LOG: '/api/audit',
    EVENTS: '/api/audit/events',
  },
};
