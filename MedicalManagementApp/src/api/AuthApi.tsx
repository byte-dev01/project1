import { AuthRequest, AuthResponse } from '../../types/api.types';
import { User } from '../../types/models.types';
import { securityManager } from '../services/security';
import { apiClient } from './ApiClient';
import { API_ENDPOINTS } from './endpoints';

class AuthAPI {
  async login(credentials: AuthRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );
      
      // Log security event
      await securityManager.logSecurityEvent({
        type: 'LOGIN_SUCCESS',
        userId: response.data.user.id,
        details: { clinicId: credentials.clinicId }
      });
      
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await securityManager.logSecurityEvent({
        type: 'LOGIN_FAILED',
        details: { username: credentials.username, error: errorMessage }      });
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken }
    );
    return response.data;
  }

  async whoami(): Promise<User> {
    const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.WHOAMI);
    return response.data;
  }

  async verifyUser(principalUri: string): Promise<any> {
    const response = await apiClient.post('/api/verifyUser', { principalUri });
    return response.data;
  }
}

export const authAPI = new AuthAPI();
