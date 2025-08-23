/**
 * OAuth Service for HealthBridge Medical Management App
 * Implements OAuth 2.0 with PKCE for secure authentication
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { 
  OAUTH_CONFIG, 
  OAUTH_ERRORS, 
  OAuthState, 
  TokenResponse, 
  UserInfoResponse 
} from '@/src/config/oauth.config';
import { auditTrailService } from '@/core/compliance/AuditTrail';
import { encrypt, decrypt } from '@utils/encryption';

// Complete auth session for web
WebBrowser.maybeCompleteAuthSession();

class OAuthService {
  private discovery: AuthSession.DiscoveryDocument | null = null;
  private currentState: OAuthState | null = null;
  private refreshTokenTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize OAuth discovery document
   */
  async initialize(): Promise<void> {
    try {
      // Create discovery document from config
      this.discovery = {
        authorizationEndpoint: OAUTH_CONFIG.authorizationEndpoint,
        tokenEndpoint: OAUTH_CONFIG.tokenEndpoint,
        revocationEndpoint: OAUTH_CONFIG.revocationEndpoint,
        userInfoEndpoint: OAUTH_CONFIG.userInfoEndpoint,
      };

      console.log('OAuth service initialized');
    } catch (error) {
      console.error('Failed to initialize OAuth:', error);
      throw error;
    }
  }

  /**
   * Generate PKCE challenge for secure authorization
   */
  private async generatePKCEChallenge(): Promise<{ 
    codeVerifier: string; 
    codeChallenge: string; 
    codeChallengeMethod: string;
  }> {
    const codeVerifier = AuthSession.AuthRequest.PKCE.codeVerifier(128);
    const codeChallenge = await AuthSession.AuthRequest.PKCE.codeChallenge(codeVerifier);
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  /**
   * Generate secure state and nonce
   */
  private async generateSecureTokens(): Promise<{ state: string; nonce: string }> {
    const state = await Crypto.getRandomBytesAsync(32);
    const nonce = await Crypto.getRandomBytesAsync(32);
    
    return {
      state: btoa(String.fromCharCode(...new Uint8Array(state))),
      nonce: btoa(String.fromCharCode(...new Uint8Array(nonce))),
    };
  }

  /**
   * Start OAuth authentication flow
   */
  async authenticate(): Promise<TokenResponse> {
    try {
      if (!this.discovery) {
        await this.initialize();
      }

      // Generate PKCE challenge
      const pkce = await this.generatePKCEChallenge();
      
      // Generate state and nonce
      const { state, nonce } = await this.generateSecureTokens();

      // Store state for validation
      this.currentState = {
        state,
        codeVerifier: pkce.codeVerifier,
        nonce,
        timestamp: Date.now(),
      };

      // Store code verifier securely for token exchange
      await SecureStore.setItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.codeVerifier,
        pkce.codeVerifier
      );

      // Create auth request
      const request = new AuthSession.AuthRequest({
        clientId: OAUTH_CONFIG.clientId,
        scopes: OAUTH_CONFIG.scopes,
        redirectUri: OAUTH_CONFIG.redirectUri,
        responseType: OAUTH_CONFIG.responseType,
        state,
        codeChallenge: pkce.codeChallenge,
        codeChallengeMethod: pkce.codeChallengeMethod,
        extraParams: {
          ...OAUTH_CONFIG.customParams,
          nonce,
        },
      });

      // Log authentication attempt
      await auditTrailService.logAccess({
        userId: 'pre-auth',
        action: 'OAUTH_AUTH_INITIATED',
        resourceType: 'AUTHENTICATION',
        resourceId: 'oauth-flow',
        userRole: 'unauthenticated',
        metadata: {
          clientId: OAUTH_CONFIG.clientId,
          scopes: OAUTH_CONFIG.scopes,
        },
      });

      // Start auth session
      const result = await request.promptAsync({
        authorizationEndpoint: OAUTH_CONFIG.authorizationEndpoint,
      });

      if (result.type === 'success') {
        // Validate state
        if (result.params.state !== state) {
          throw new Error('State mismatch - possible CSRF attack');
        }

        // Exchange code for tokens
        const tokens = await this.exchangeCodeForTokens(
          result.params.code,
          pkce.codeVerifier
        );

        // Store tokens securely
        await this.storeTokensSecurely(tokens);

        // Schedule token refresh
        this.scheduleTokenRefresh(tokens.expires_in);

        // Log successful authentication
        await auditTrailService.logAccess({
          userId: tokens.access_token.split('.')[1], // Extract sub from JWT
          action: 'OAUTH_AUTH_SUCCESS',
          resourceType: 'AUTHENTICATION',
          resourceId: 'oauth-flow',
          userRole: 'authenticated',
        });

        return tokens;
      } else if (result.type === 'error') {
        // Log authentication failure
        await auditTrailService.logAccess({
          userId: 'pre-auth',
          action: 'OAUTH_AUTH_FAILED',
          resourceType: 'AUTHENTICATION',
          resourceId: 'oauth-flow',
          userRole: 'unauthenticated',
          metadata: {
            error: result.error,
            errorDescription: result.error_description,
          },
        });

        throw new Error(
          OAUTH_ERRORS[result.error?.toUpperCase() as keyof typeof OAUTH_ERRORS] || 
          result.error_description || 
          'Authentication failed'
        );
      } else {
        throw new Error('Authentication cancelled');
      }
    } catch (error) {
      console.error('OAuth authentication failed:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    code: string, 
    codeVerifier: string
  ): Promise<TokenResponse> {
    try {
      const response = await fetch(OAUTH_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...OAUTH_CONFIG.additionalHeaders,
        },
        body: new URLSearchParams({
          grant_type: OAUTH_CONFIG.grantTypes.authorizationCode,
          code,
          client_id: OAUTH_CONFIG.clientId,
          redirect_uri: OAUTH_CONFIG.redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Token exchange failed');
      }

      const tokens: TokenResponse = await response.json();
      return tokens;
    } catch (error) {
      console.error('Token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Store tokens securely with encryption
   */
  private async storeTokensSecurely(tokens: TokenResponse): Promise<void> {
    try {
      // Generate encryption key for tokens
      const encryptionKey = await Crypto.getRandomBytesAsync(32);
      const keyString = btoa(String.fromCharCode(...new Uint8Array(encryptionKey)));

      // Encrypt tokens
      const encryptedAccessToken = await encrypt(tokens.access_token, keyString);
      const encryptedRefreshToken = tokens.refresh_token 
        ? await encrypt(tokens.refresh_token, keyString) 
        : null;
      const encryptedIdToken = tokens.id_token 
        ? await encrypt(tokens.id_token, keyString) 
        : null;

      // Store encrypted tokens
      await SecureStore.setItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.accessToken,
        encryptedAccessToken
      );
      
      if (encryptedRefreshToken) {
        await SecureStore.setItemAsync(
          OAUTH_CONFIG.tokenStorageKeys.refreshToken,
          encryptedRefreshToken
        );
      }

      if (encryptedIdToken) {
        await SecureStore.setItemAsync(
          OAUTH_CONFIG.tokenStorageKeys.idToken,
          encryptedIdToken
        );
      }

      // Store token expiry
      const expiryTime = Date.now() + (tokens.expires_in * 1000);
      await SecureStore.setItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.tokenExpiry,
        expiryTime.toString()
      );

      // Store encryption key separately
      await SecureStore.setItemAsync('oauth_encryption_key', keyString);
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt stored tokens
   */
  async getStoredTokens(): Promise<TokenResponse | null> {
    try {
      // Get encryption key
      const keyString = await SecureStore.getItemAsync('oauth_encryption_key');
      if (!keyString) return null;

      // Get encrypted tokens
      const encryptedAccessToken = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.accessToken
      );
      const encryptedRefreshToken = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.refreshToken
      );
      const encryptedIdToken = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.idToken
      );
      const expiryString = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.tokenExpiry
      );

      if (!encryptedAccessToken) return null;

      // Decrypt tokens
      const accessToken = await decrypt(encryptedAccessToken, keyString);
      const refreshToken = encryptedRefreshToken 
        ? await decrypt(encryptedRefreshToken, keyString) 
        : undefined;
      const idToken = encryptedIdToken 
        ? await decrypt(encryptedIdToken, keyString) 
        : undefined;

      // Calculate expires_in
      const expiry = expiryString ? parseInt(expiryString) : 0;
      const expires_in = Math.floor((expiry - Date.now()) / 1000);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in,
        refresh_token: refreshToken,
        id_token: idToken,
      };
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<TokenResponse> {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens?.refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(OAUTH_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...OAUTH_CONFIG.additionalHeaders,
        },
        body: new URLSearchParams({
          grant_type: OAUTH_CONFIG.grantTypes.refreshToken,
          refresh_token: tokens.refresh_token,
          client_id: OAUTH_CONFIG.clientId,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // If refresh fails, need to re-authenticate
        if (error.error === 'invalid_grant') {
          await this.logout();
          throw new Error('Session expired. Please login again.');
        }
        
        throw new Error(error.error_description || 'Token refresh failed');
      }

      const newTokens: TokenResponse = await response.json();
      
      // Store new tokens
      await this.storeTokensSecurely(newTokens);
      
      // Reschedule refresh
      this.scheduleTokenRefresh(newTokens.expires_in);

      // Log token refresh
      await auditTrailService.logAccess({
        userId: newTokens.access_token.split('.')[1],
        action: 'OAUTH_TOKEN_REFRESHED',
        resourceType: 'AUTHENTICATION',
        resourceId: 'token-refresh',
        userRole: 'authenticated',
      });

      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    // Clear existing timer
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
    }

    // Schedule refresh before expiry
    const refreshTime = (expiresIn * 1000) - OAUTH_CONFIG.refreshThreshold;
    
    this.refreshTokenTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
      }
    }, refreshTime);
  }

  /**
   * Get user information from OAuth provider
   */
  async getUserInfo(): Promise<UserInfoResponse> {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens) {
        throw new Error('No valid tokens found');
      }

      // Check if token needs refresh
      const expiryString = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.tokenExpiry
      );
      const expiry = expiryString ? parseInt(expiryString) : 0;
      
      if (expiry - Date.now() < OAUTH_CONFIG.refreshThreshold) {
        await this.refreshAccessToken();
      }

      const response = await fetch(OAUTH_CONFIG.userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          ...OAUTH_CONFIG.additionalHeaders,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo: UserInfoResponse = await response.json();
      return userInfo;
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Revoke tokens and logout
   */
  async logout(): Promise<void> {
    try {
      const tokens = await this.getStoredTokens();
      
      // Revoke tokens on server if available
      if (tokens?.access_token && OAUTH_CONFIG.revocationEndpoint) {
        try {
          await fetch(OAUTH_CONFIG.revocationEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              ...OAUTH_CONFIG.additionalHeaders,
            },
            body: new URLSearchParams({
              token: tokens.access_token,
              token_type_hint: 'access_token',
              client_id: OAUTH_CONFIG.clientId,
            }).toString(),
          });

          // Also revoke refresh token if exists
          if (tokens.refresh_token) {
            await fetch(OAUTH_CONFIG.revocationEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...OAUTH_CONFIG.additionalHeaders,
              },
              body: new URLSearchParams({
                token: tokens.refresh_token,
                token_type_hint: 'refresh_token',
                client_id: OAUTH_CONFIG.clientId,
              }).toString(),
            });
          }
        } catch (error) {
          console.error('Token revocation failed:', error);
        }
      }

      // Clear stored tokens
      await SecureStore.deleteItemAsync(OAUTH_CONFIG.tokenStorageKeys.accessToken);
      await SecureStore.deleteItemAsync(OAUTH_CONFIG.tokenStorageKeys.refreshToken);
      await SecureStore.deleteItemAsync(OAUTH_CONFIG.tokenStorageKeys.idToken);
      await SecureStore.deleteItemAsync(OAUTH_CONFIG.tokenStorageKeys.tokenExpiry);
      await SecureStore.deleteItemAsync(OAUTH_CONFIG.tokenStorageKeys.codeVerifier);
      await SecureStore.deleteItemAsync('oauth_encryption_key');

      // Clear timer
      if (this.refreshTokenTimer) {
        clearTimeout(this.refreshTokenTimer);
        this.refreshTokenTimer = null;
      }

      // Clear state
      this.currentState = null;

      // Log logout
      await auditTrailService.logAccess({
        userId: 'logged-out',
        action: 'OAUTH_LOGOUT',
        resourceType: 'AUTHENTICATION',
        resourceId: 'oauth-logout',
        userRole: 'unauthenticated',
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens) return false;

      // Check if token is expired
      const expiryString = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.tokenExpiry
      );
      const expiry = expiryString ? parseInt(expiryString) : 0;
      
      return expiry > Date.now();
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Get current access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens) return null;

      // Check if token needs refresh
      const expiryString = await SecureStore.getItemAsync(
        OAUTH_CONFIG.tokenStorageKeys.tokenExpiry
      );
      const expiry = expiryString ? parseInt(expiryString) : 0;
      
      if (expiry - Date.now() < OAUTH_CONFIG.refreshThreshold) {
        const newTokens = await this.refreshAccessToken();
        return newTokens.access_token;
      }

      return tokens.access_token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const oAuthService = new OAuthService();