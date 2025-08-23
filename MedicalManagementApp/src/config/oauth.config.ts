/**
 * OAuth Configuration for HealthBridge Medical Management App
 * HIPAA-compliant OAuth 2.0 setup with PKCE
 */

export const OAUTH_CONFIG = {
  // OAuth Provider Settings
  authorizationEndpoint: 'https://healthbridge.up.railway.app/oauth/authorize',
  tokenEndpoint: 'https://healthbridge.up.railway.app/oauth/token',
  revocationEndpoint: 'https://healthbridge.up.railway.app/oauth/revoke',
  userInfoEndpoint: 'https://healthbridge.up.railway.app/oauth/userinfo',
  
  // Client Configuration
  clientId: process.env.OAUTH_CLIENT_ID || 'healthbridge-mobile',
  redirectUri: 'healthbridge://oauth-callback',
  
  // OAuth Scopes for HIPAA compliance
  scopes: [
    'openid',
    'profile',
    'email',
    'patient:read',
    'patient:write',
    'prescription:read',
    'prescription:write',
    'medical_records:read',
    'audit:write',
    'offline_access', // For refresh tokens
  ],
  
  // Security Settings
  usePKCE: true, // Required for mobile apps
  useNonce: true, // Prevent replay attacks
  
  // Token Management
  tokenStorageKeys: {
    accessToken: 'oauth_access_token',
    refreshToken: 'oauth_refresh_token',
    idToken: 'oauth_id_token',
    tokenExpiry: 'oauth_token_expiry',
    codeVerifier: 'oauth_code_verifier',
  },
  
  // Session Configuration
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  refreshThreshold: 5 * 60 * 1000, // Refresh 5 minutes before expiry
  
  // Additional Headers for HIPAA compliance
  additionalHeaders: {
    'X-Client-Type': 'Mobile-OAuth',
    'X-HIPAA-Compliant': 'true',
    'X-Encryption': 'AES-256',
  },
  
  // Custom Parameters
  customParams: {
    prompt: 'consent', // Always ask for consent
    access_type: 'offline', // Get refresh token
    include_granted_scopes: 'true',
  },
  
  // Response Type for Authorization Code Flow
  responseType: 'code',
  
  // Grant Types
  grantTypes: {
    authorizationCode: 'authorization_code',
    refreshToken: 'refresh_token',
    clientCredentials: 'client_credentials',
  },
};

// OAuth Error Messages
export const OAUTH_ERRORS = {
  INVALID_GRANT: 'Invalid authorization grant. Please login again.',
  INVALID_CLIENT: 'Client authentication failed.',
  INVALID_REQUEST: 'The request is missing required parameters.',
  UNAUTHORIZED_CLIENT: 'The client is not authorized.',
  ACCESS_DENIED: 'Access was denied by the authorization server.',
  UNSUPPORTED_RESPONSE_TYPE: 'The authorization server does not support this response type.',
  INVALID_SCOPE: 'The requested scope is invalid or unknown.',
  SERVER_ERROR: 'The authorization server encountered an error.',
  TEMPORARILY_UNAVAILABLE: 'The authorization server is temporarily unavailable.',
  EXPIRED_TOKEN: 'The access token has expired.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
};

// OAuth State Management
export interface OAuthState {
  state: string;
  codeVerifier: string;
  nonce: string;
  timestamp: number;
}

// Token Response Interface
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

// User Info Response
export interface UserInfoResponse {
  sub: string; // Subject identifier
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  roles?: string[];
  permissions?: string[];
  clinic_id?: string;
  provider_id?: string;
  license_number?: string;
}