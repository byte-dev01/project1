/**
 * OAuth WebView Bridge
 * Integrates OAuth authentication with WebView for seamless JWT handling
 */

import { oAuthService } from './OAuthService';
import { useAuthStore } from '@store/authStore';

export class OAuthWebViewBridge {
  private static instance: OAuthWebViewBridge;
  private webViewRef: any = null;

  private constructor() {}

  static getInstance(): OAuthWebViewBridge {
    if (!OAuthWebViewBridge.instance) {
      OAuthWebViewBridge.instance = new OAuthWebViewBridge();
    }
    return OAuthWebViewBridge.instance;
  }

  /**
   * Set WebView reference for communication
   */
  setWebViewRef(ref: any): void {
    this.webViewRef = ref;
  }

  /**
   * Inject OAuth tokens into WebView for JWT authentication
   */
  async injectTokensIntoWebView(): Promise<void> {
    if (!this.webViewRef) {
      console.warn('WebView ref not set');
      return;
    }

    try {
      const token = await oAuthService.getAccessToken();
      if (!token) {
        console.warn('No OAuth token available');
        return;
      }

      // Parse JWT to extract user info
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));

      // Inject tokens and user info into WebView
      const injection = `
        (function() {
          try {
            // Store OAuth token as JWT in localStorage
            localStorage.setItem('jwt_token', '${token}');
            localStorage.setItem('auth_method', 'oauth');
            
            // Store user info
            localStorage.setItem('user_info', JSON.stringify({
              id: '${payload.sub}',
              email: '${payload.email || ''}',
              name: '${payload.name || ''}',
              roles: ${JSON.stringify(payload.roles || [])},
              permissions: ${JSON.stringify(payload.permissions || [])},
              clinicId: '${payload.clinic_id || ''}',
              providerId: '${payload.provider_id || ''}',
              exp: ${payload.exp}
            }));
            
            // Set authorization header for all requests
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
              options.headers = options.headers || {};
              options.headers['Authorization'] = 'Bearer ${token}';
              return originalFetch.call(this, url, options);
            };
            
            // Set authorization for XMLHttpRequest
            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function() {
              const result = originalXHROpen.apply(this, arguments);
              this.setRequestHeader('Authorization', 'Bearer ${token}');
              return result;
            };
            
            // Dispatch custom event to notify the web app
            window.dispatchEvent(new CustomEvent('oauth-authenticated', {
              detail: {
                token: '${token}',
                expiresAt: ${payload.exp * 1000},
                userId: '${payload.sub}',
                authMethod: 'oauth'
              }
            }));
            
            // Auto-refresh mechanism
            const expiresIn = ${payload.exp * 1000} - Date.now();
            const refreshThreshold = 5 * 60 * 1000; // 5 minutes
            
            if (expiresIn > refreshThreshold) {
              setTimeout(() => {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'REFRESH_TOKEN_NEEDED',
                  timestamp: Date.now()
                }));
              }, expiresIn - refreshThreshold);
            }
            
            console.log('OAuth tokens injected successfully');
            return true;
          } catch (error) {
            console.error('Failed to inject OAuth tokens:', error);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'OAUTH_INJECTION_ERROR',
              error: error.message,
              timestamp: Date.now()
            }));
            return false;
          }
        })();
      `;

      this.webViewRef.injectJavaScript(injection);
    } catch (error) {
      console.error('Failed to inject OAuth tokens:', error);
    }
  }

  /**
   * Handle token refresh request from WebView
   */
  async handleTokenRefreshRequest(): Promise<void> {
    try {
      const newTokens = await oAuthService.refreshAccessToken();
      await this.injectTokensIntoWebView();
      
      // Notify WebView of successful refresh
      if (this.webViewRef) {
        this.webViewRef.injectJavaScript(`
          window.dispatchEvent(new CustomEvent('oauth-token-refreshed', {
            detail: {
              token: '${newTokens.access_token}',
              timestamp: ${Date.now()}
            }
          }));
        `);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // Notify WebView of refresh failure
      if (this.webViewRef) {
        this.webViewRef.injectJavaScript(`
          window.dispatchEvent(new CustomEvent('oauth-token-refresh-failed', {
            detail: {
              error: '${error.message}',
              timestamp: ${Date.now()}
            }
          }));
        `);
      }
      
      // Force re-authentication
      await useAuthStore.getState().logout();
    }
  }

  /**
   * Sync WebView session with OAuth session
   */
  async syncWebViewSession(): Promise<void> {
    const isAuthenticated = await oAuthService.isAuthenticated();
    
    if (isAuthenticated) {
      await this.injectTokensIntoWebView();
    } else {
      // Clear WebView session
      if (this.webViewRef) {
        this.webViewRef.injectJavaScript(`
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user_info');
          localStorage.removeItem('auth_method');
          sessionStorage.clear();
          
          window.dispatchEvent(new CustomEvent('oauth-logout', {
            detail: { timestamp: ${Date.now()} }
          }));
        `);
      }
    }
  }

  /**
   * Handle OAuth callback from WebView
   */
  async handleOAuthCallback(url: string): Promise<boolean> {
    // Check if this is an OAuth callback URL
    if (!url.startsWith(OAUTH_CONFIG.redirectUri)) {
      return false;
    }

    try {
      // Extract authorization code from URL
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        throw new Error(urlParams.get('error_description') || error);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Let OAuth service handle the code exchange
      // This would need to be implemented in the OAuth service
      console.log('OAuth callback received with code:', code);
      
      // Inject success message into WebView
      if (this.webViewRef) {
        this.webViewRef.injectJavaScript(`
          window.dispatchEvent(new CustomEvent('oauth-callback-received', {
            detail: {
              success: true,
              timestamp: ${Date.now()}
            }
          }));
        `);
      }

      return true;
    } catch (error) {
      console.error('OAuth callback error:', error);
      
      // Inject error message into WebView
      if (this.webViewRef) {
        this.webViewRef.injectJavaScript(`
          window.dispatchEvent(new CustomEvent('oauth-callback-error', {
            detail: {
              error: '${error.message}',
              timestamp: ${Date.now()}
            }
          }));
        `);
      }
      
      return false;
    }
  }

  /**
   * Create JavaScript bridge for bi-directional communication
   */
  getWebViewBridgeScript(): string {
    return `
      (function() {
        // Create OAuth bridge object
        window.OAuthBridge = {
          // Request token refresh
          refreshToken: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'OAUTH_REFRESH_TOKEN',
              timestamp: Date.now()
            }));
          },
          
          // Get current auth state
          getAuthState: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'OAUTH_GET_STATE',
              timestamp: Date.now()
            }));
          },
          
          // Logout
          logout: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'OAUTH_LOGOUT',
              timestamp: Date.now()
            }));
          },
          
          // Check if authenticated
          isAuthenticated: function() {
            const token = localStorage.getItem('jwt_token');
            if (!token) return false;
            
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              return payload.exp * 1000 > Date.now();
            } catch {
              return false;
            }
          },
          
          // Get user info
          getUserInfo: function() {
            const userInfo = localStorage.getItem('user_info');
            return userInfo ? JSON.parse(userInfo) : null;
          },
          
          // Add interceptor for 401 responses
          interceptUnauthorized: function() {
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
              return originalFetch.call(this, url, options)
                .then(response => {
                  if (response.status === 401) {
                    // Token expired, request refresh
                    window.OAuthBridge.refreshToken();
                  }
                  return response;
                });
            };
          }
        };
        
        // Auto-initialize interceptor
        window.OAuthBridge.interceptUnauthorized();
        
        // Notify that bridge is ready
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'OAUTH_BRIDGE_READY',
          timestamp: Date.now()
        }));
        
        console.log('OAuth Bridge initialized');
      })();
    `;
  }
}

// Export singleton instance
export const oAuthWebViewBridge = OAuthWebViewBridge.getInstance();

// Import statement for use in SecureWebViewWrapper
import { OAUTH_CONFIG } from '../config/oauth.config';