import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../src/api/auth';
import { User } from '../types/models.types';
import { AUTH_CONFIG } from '../utils/constants';
import { securityManager } from '../src/services/security';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (username: string, password: string, clinicId: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  login: async (username, password, clinicId) => {
    set({ loading: true, error: null });
    
    try {
      const response = await authAPI.login({ username, password, clinicId });
      const { user, token, refreshToken } = response;
      
      // Store tokens securely
      await SecureStore.setItemAsync(AUTH_CONFIG.TOKEN_KEY, token);
      await SecureStore.setItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY, refreshToken);
      await SecureStore.setItemAsync(AUTH_CONFIG.USER_KEY, JSON.stringify(user));
      
      // Store credentials for biometric login
      await SecureStore.setItemAsync(
        AUTH_CONFIG.CREDENTIALS_KEY,
        JSON.stringify({ username, password, clinicId })
      );
      
      set({ 
        user, 
        token, 
        refreshToken,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      
      // Log security event
      await securityManager.logSecurityEvent({
        type: 'LOGIN_SUCCESS',
        userId: user.id,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      set({ 
        loading: false, 
        error: errorMessage,
        isAuthenticated: false,
      });
      
      // Log security event
      await securityManager.logSecurityEvent({
        type: 'LOGIN_FAILED',
        details: { username, error: errorMessage },
      });
      
      throw error;
    }
  },

  logout: async () => {
    const { user } = get();
    
    try {
      // Call logout API
      await authAPI.logout();
      
      // Log security event
      if (user) {
        await securityManager.logSecurityEvent({
          type: 'LOGOUT',
          userId: user.id,
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear stored data
      await SecureStore.deleteItemAsync(AUTH_CONFIG.TOKEN_KEY);
      await SecureStore.deleteItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AUTH_CONFIG.USER_KEY);
      await SecureStore.deleteItemAsync(AUTH_CONFIG.CREDENTIALS_KEY);
      
      // Reset state
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });
      
      // Stop session timer
      securityManager.stopSessionTimer();
    }
  },

  checkAuthStatus: async () => {
    set({ loading: true });
    
    try {
      const [token, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(AUTH_CONFIG.TOKEN_KEY),
        SecureStore.getItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(AUTH_CONFIG.USER_KEY),
      ]);
      
      if (token && userJson) {
        const user = JSON.parse(userJson);
        
        // Verify token is still valid
        try {
          const currentUser = await authAPI.whoami();
          
          set({
            user: currentUser,
            token,
            refreshToken,
            isAuthenticated: true,
            loading: false,
          });
          
          // Start session timer
          securityManager.startSessionTimer(() => {
            get().logout();
          });
        } catch (error) {
          // Token is invalid, clear auth
          await get().logout();
        }
      } else {
        set({ loading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ loading: false, isAuthenticated: false });
    }
  },

  updateUser: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));


