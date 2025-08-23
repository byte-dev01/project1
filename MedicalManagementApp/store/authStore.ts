import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { authAPI } from '../src/api/AuthApi';
import { oAuthService } from '../src/services/OAuthService';
import { securityManager } from '../src/services/security';
import { User } from '../types/models.types';
import { AUTH_CONFIG } from '../utils/constants';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  authMethod: 'traditional' | 'oauth' | null;
  
  // Actions
  login: (username: string, password: string, clinicId: string) => Promise<void>;
  loginWithOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  refreshTokens: () => Promise<void>;
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
  authMethod: null,

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
        authMethod: 'traditional',
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

  loginWithOAuth: async () => {
    set({ loading: true, error: null });
    
    try {
      // Initialize OAuth service
      await oAuthService.initialize();
      
      // Start OAuth flow
      const tokens = await oAuthService.authenticate();
      
      // Store OAuth tokens first so API client can use them
      await SecureStore.setItemAsync(AUTH_CONFIG.TOKEN_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        await SecureStore.setItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY, tokens.refresh_token);
      }
      
      // Set token in store state so apiClient can use it
      set({ 
        token: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
      });
      
      // Now fetch the complete user object from our backend using the OAuth token
      // The apiClient will automatically use the token we just stored
      const user = await authAPI.whoami();
      
      // Store user info
      await SecureStore.setItemAsync(AUTH_CONFIG.USER_KEY, JSON.stringify(user));
      
      set({ 
        user, 
        isAuthenticated: true,
        loading: false,
        error: null,
        authMethod: 'oauth',
      });
      
      // Log security event
      await securityManager.logSecurityEvent({
        type: 'OAUTH_LOGIN_SUCCESS',
        userId: user.id,
        details: {
          provider: 'healthbridge',
          scopes: tokens.scope,
        },
      });
      
      // Start session timer
      securityManager.startSessionTimer(() => {
        get().logout();
      });
    } catch (error: any) {
      const errorMessage = error.message || 'OAuth login failed';
      set({ 
        loading: false, 
        error: errorMessage,
        isAuthenticated: false,
      });
      
      // Log security event
      await securityManager.logSecurityEvent({
        type: 'OAUTH_LOGIN_FAILED',
        details: { error: errorMessage },
      });
      
      throw error;
    }
  },

  logout: async () => {
    const { user, authMethod } = get();
    
    try {
      // Handle OAuth logout
      if (authMethod === 'oauth') {
        await oAuthService.logout();
      } else {
        // Call traditional logout API
        await authAPI.logout();
      }
      
      // Log security event
      if (user) {
        await securityManager.logSecurityEvent({
          type: 'LOGOUT',
          userId: user.id,
          details: { authMethod },
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
        authMethod: null,
      });
      
      // Stop session timer
      securityManager.stopSessionTimer();
    }
  },

  checkAuthStatus: async () => {
    set({ loading: true });
    
    try {
      // First check OAuth authentication
      const isOAuthAuthenticated = await oAuthService.isAuthenticated();
      
      if (isOAuthAuthenticated) {
        // Get OAuth tokens
        const tokens = await oAuthService.getStoredTokens();
        
        // Store tokens so API client can use them
        if (tokens?.access_token) {
          await SecureStore.setItemAsync(AUTH_CONFIG.TOKEN_KEY, tokens.access_token);
          if (tokens.refresh_token) {
            await SecureStore.setItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY, tokens.refresh_token);
          }
        }
        
        // Fetch complete user object from backend using OAuth token
        const user = await authAPI.whoami();
        
        set({
          user,
          token: tokens?.access_token || null,
          refreshToken: tokens?.refresh_token || null,
          isAuthenticated: true,
          loading: false,
          authMethod: 'oauth',
        });
        
        // Start session timer
        securityManager.startSessionTimer(() => {
          get().logout();
        });
      } else {
        // Check traditional authentication
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
              authMethod: 'traditional',
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
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ loading: false, isAuthenticated: false });
    }
  },

  refreshTokens: async () => {
    const { authMethod } = get();
    
    try {
      if (authMethod === 'oauth') {
        // Refresh OAuth tokens
        const newTokens = await oAuthService.refreshAccessToken();
        set({
          token: newTokens.access_token,
          refreshToken: newTokens.refresh_token || get().refreshToken,
        });
      } else if (authMethod === 'traditional') {
        // Refresh traditional tokens
        const refreshToken = await SecureStore.getItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const response = await authAPI.refreshToken(refreshToken);
          
          // Store new tokens
          await SecureStore.setItemAsync(AUTH_CONFIG.TOKEN_KEY, response.token);
          await SecureStore.setItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY, response.refreshToken);
          
          set({
            token: response.token,
            refreshToken: response.refreshToken,
          });
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout
      await get().logout();
      throw error;
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


