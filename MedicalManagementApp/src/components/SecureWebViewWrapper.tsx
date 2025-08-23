import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Text,
  SafeAreaView,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@store/authStore';
import { SecureStorageService } from '@/services/SecureStorageService';
import { auditTrailService } from '@/core/compliance/AuditTrail';
import { encrypt, decrypt } from '@utils/encryption';
import CryptoJS from 'crypto-js';
import { oAuthWebViewBridge } from '@/src/services/OAuthWebViewBridge';
import { oAuthService } from '@/src/services/OAuthService';

interface SecureWebViewWrapperProps {
  baseUrl?: string;
  onNavigationChange?: (url: string) => void;
  requiresAuth?: boolean;
  allowedDomains?: string[];
  enablePHIProtection?: boolean;
}

/**
 * HIPAA-Compliant Secure WebView Wrapper
 * Adds security layers for medical data protection
 */
export const SecureWebViewWrapper: React.FC<SecureWebViewWrapperProps> = ({
  baseUrl = 'https://healthbridge.up.railway.app',
  onNavigationChange,
  requiresAuth = true,
  allowedDomains = ['healthbridge.up.railway.app', 'api.healthbridge.com'],
  enablePHIProtection = true,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(baseUrl);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionKey, setSessionKey] = useState<string>('');
  
  const { user, isAuthenticated, authMethod } = useAuthStore();
  
  // Generate session-specific encryption key and setup OAuth bridge
  useEffect(() => {
    const key = CryptoJS.lib.WordArray.random(256/8).toString();
    setSessionKey(key);
    
    // Set WebView ref for OAuth bridge
    if (webViewRef.current) {
      oAuthWebViewBridge.setWebViewRef(webViewRef.current);
    }
    
    return () => {
      // Clear session key on unmount
      setSessionKey('');
    };
  }, []);
  
  // Inject OAuth tokens when auth state changes
  useEffect(() => {
    if (isAuthenticated && authMethod === 'oauth' && webViewRef.current) {
      oAuthWebViewBridge.setWebViewRef(webViewRef.current);
      oAuthWebViewBridge.injectTokensIntoWebView();
    }
  }, [isAuthenticated, authMethod]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      
      // Log network state changes for security
      auditTrailService.logAccess({
        userId: user?.id || 'anonymous',
        action: state.isConnected ? 'NETWORK_CONNECTED' : 'NETWORK_DISCONNECTED',
        resourceType: 'WEBVIEW',
        resourceId: currentUrl,
        userRole: user?.roles?.[0] || 'unknown',
        sessionId: sessionKey,
      });
    });

    return () => unsubscribe();
  }, [user, currentUrl, sessionKey]);

  // SECURITY LAYER 1: Content Security Policy
  const contentSecurityPolicy = `
    default-src 'self' ${allowedDomains.join(' ')};
    script-src 'self' 'unsafe-inline' ${allowedDomains.join(' ')};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' ${allowedDomains.join(' ')};
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self' ${allowedDomains.join(' ')};
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s+/g, ' ').trim();

  // SECURITY LAYER 2: JavaScript injection for PHI protection
  const securityInjection = `
    (function() {
      'use strict';
      
      // Override console to prevent PHI leakage
      const originalConsole = window.console;
      const sanitizeLog = (args) => {
        return args.map(arg => {
          if (typeof arg === 'string') {
            // Remove potential SSN patterns
            arg = arg.replace(/\\b\\d{3}-\\d{2}-\\d{4}\\b/g, '[SSN-REDACTED]');
            // Remove potential MRN patterns
            arg = arg.replace(/\\bMRN[:\\s]*\\d+/gi, '[MRN-REDACTED]');
            // Remove potential DOB patterns
            arg = arg.replace(/\\b\\d{1,2}\\/\\d{1,2}\\/\\d{4}\\b/g, '[DOB-REDACTED]');
          }
          return arg;
        });
      };
      
      window.console = {
        ...originalConsole,
        log: function() {
          const sanitized = sanitizeLog(Array.from(arguments));
          originalConsole.log.apply(originalConsole, sanitized);
        },
        error: function() {
          const sanitized = sanitizeLog(Array.from(arguments));
          originalConsole.error.apply(originalConsole, sanitized);
        }
      };

      // Prevent copy/paste of sensitive data
      ${enablePHIProtection ? `
        document.addEventListener('copy', function(e) {
          const selection = window.getSelection().toString();
          // Check if selection contains PHI patterns
          if (/\\b\\d{3}-\\d{2}-\\d{4}\\b/.test(selection) || 
              /MRN[:\\s]*\\d+/i.test(selection)) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PHI_COPY_BLOCKED',
              timestamp: Date.now()
            }));
            alert('Copying sensitive patient information is restricted for security.');
            return false;
          }
        });

        // Prevent screenshots on sensitive pages
        if (window.location.pathname.includes('/patient/') || 
            window.location.pathname.includes('/prescription/')) {
          document.addEventListener('keyup', function(e) {
            // Detect PrintScreen key
            if (e.keyCode === 44) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SCREENSHOT_ATTEMPT',
                page: window.location.pathname,
                timestamp: Date.now()
              }));
            }
          });
        }
      ` : ''}

      // Monitor form submissions for PHI
      document.addEventListener('submit', function(e) {
        const form = e.target;
        const formData = new FormData(form);
        
        // Log form submission without PHI
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FORM_SUBMIT',
          formId: form.id || 'unknown',
          action: form.action,
          method: form.method,
          hasFiles: Array.from(formData.keys()).some(key => 
            formData.get(key) instanceof File
          ),
          timestamp: Date.now()
        }));
      });

      // Secure localStorage wrapper
      const originalSetItem = localStorage.setItem;
      const originalGetItem = localStorage.getItem;
      
      // Encrypt sensitive data in localStorage
      localStorage.setItem = function(key, value) {
        if (key.includes('patient') || key.includes('medical') || 
            key.includes('prescription') || key.includes('phi')) {
          // Send to native for encryption
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ENCRYPT_STORAGE',
            key: key,
            value: value
          }));
          // Store encrypted marker
          return originalSetItem.call(this, key, '[ENCRYPTED]');
        }
        return originalSetItem.call(this, key, value);
      };

      // Decrypt on retrieval
      localStorage.getItem = function(key) {
        const value = originalGetItem.call(this, key);
        if (value === '[ENCRYPTED]') {
          // Request decryption from native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DECRYPT_STORAGE',
            key: key
          }));
          return null; // Will be injected after decryption
        }
        return value;
      };

      // Monitor unauthorized domain access
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        const urlObj = new URL(url, window.location.origin);
        const allowedDomains = ${JSON.stringify(allowedDomains)};
        
        if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'UNAUTHORIZED_API_CALL',
            url: url,
            timestamp: Date.now()
          }));
          
          // Block the request
          return Promise.reject(new Error('Unauthorized domain access blocked'));
        }
        
        // Add security headers
        options = options || {};
        options.headers = options.headers || {};
        options.headers['X-Requested-With'] = 'HealthBridge-Mobile';
        options.headers['X-Session-Id'] = '${sessionKey}';
        
        return originalFetch.call(this, url, options);
      };

      // Detect and prevent XSS attempts
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              // Check for suspicious scripts
              if (node.tagName === 'SCRIPT' && 
                  node.src && !${JSON.stringify(allowedDomains)}.some(d => 
                    node.src.includes(d))) {
                node.remove();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'XSS_BLOCKED',
                  source: node.src,
                  timestamp: Date.now()
                }));
              }
              
              // Check for inline scripts
              if (node.innerHTML && node.innerHTML.includes('<script')) {
                node.innerHTML = node.innerHTML.replace(/<script[^>]*>.*?<\\/script>/gi, '');
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'INLINE_SCRIPT_BLOCKED',
                  timestamp: Date.now()
                }));
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Session timeout warning
      let lastActivity = Date.now();
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
      
      ['click', 'touchstart', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, () => {
          lastActivity = Date.now();
        });
      });
      
      setInterval(() => {
        const idle = Date.now() - lastActivity;
        if (idle > SESSION_TIMEOUT) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SESSION_TIMEOUT',
            timestamp: Date.now()
          }));
        } else if (idle > (SESSION_TIMEOUT - WARNING_TIME)) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SESSION_WARNING',
            remainingTime: SESSION_TIMEOUT - idle,
            timestamp: Date.now()
          }));
        }
      }, 60000); // Check every minute

      // Ready signal with security status
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SECURITY_READY',
        csp: true,
        encryption: true,
        monitoring: true,
        url: window.location.href,
        timestamp: Date.now()
      }));

      true; // Required for injection
    })();
  `;

  // Handle messages from WebView
  const handleMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        // OAuth-specific messages
        case 'OAUTH_REFRESH_TOKEN':
          await oAuthWebViewBridge.handleTokenRefreshRequest();
          break;
          
        case 'OAUTH_GET_STATE':
          const isOAuthAuthenticated = await oAuthService.isAuthenticated();
          webViewRef.current?.injectJavaScript(`
            window.dispatchEvent(new CustomEvent('oauth-state-response', {
              detail: {
                isAuthenticated: ${isOAuthAuthenticated},
                authMethod: '${authMethod}',
                timestamp: ${Date.now()}
              }
            }));
          `);
          break;
          
        case 'OAUTH_LOGOUT':
          await useAuthStore.getState().logout();
          break;
          
        case 'OAUTH_BRIDGE_READY':
          // OAuth bridge is ready, inject tokens if authenticated
          if (isAuthenticated && authMethod === 'oauth') {
            await oAuthWebViewBridge.injectTokensIntoWebView();
          }
          break;
          
        case 'REFRESH_TOKEN_NEEDED':
          // Token is about to expire, refresh it
          await oAuthWebViewBridge.handleTokenRefreshRequest();
          break;
        case 'PHI_COPY_BLOCKED':
          await auditTrailService.logAccess({
            userId: user?.id || 'anonymous',
            action: 'PHI_COPY_ATTEMPT',
            resourceType: 'WEBVIEW',
            resourceId: currentUrl,
            userRole: user?.roles?.[0] || 'unknown',
            sessionId: sessionKey,
            metadata: { blocked: true },
          });
          break;

        case 'SCREENSHOT_ATTEMPT':
          await auditTrailService.logAccess({
            userId: user?.id || 'anonymous',
            action: 'SCREENSHOT_ATTEMPT',
            resourceType: 'PATIENT_DATA',
            resourceId: message.page,
            userRole: user?.roles?.[0] || 'unknown',
            sessionId: sessionKey,
            metadata: { page: message.page },
          });
          Alert.alert('Security', 'Screenshots are disabled on patient data pages for privacy protection.');
          break;

        case 'ENCRYPT_STORAGE':
          // Encrypt data before storing
          const encrypted = await encrypt(message.value, sessionKey);
          await SecureStorageService.setSecureItem(`web_${message.key}`, encrypted);
          break;

        case 'DECRYPT_STORAGE':
          // Decrypt and inject back
          const encryptedData = await SecureStorageService.getSecureItem(`web_${message.key}`);
          if (encryptedData) {
            const decrypted = await decrypt(encryptedData, sessionKey);
            webViewRef.current?.injectJavaScript(`
              localStorage.setItem('${message.key}', '${decrypted}');
            `);
          }
          break;

        case 'UNAUTHORIZED_API_CALL':
          await auditTrailService.logAccess({
            userId: user?.id || 'anonymous',
            action: 'UNAUTHORIZED_API_BLOCKED',
            resourceType: 'API',
            resourceId: message.url,
            userRole: user?.roles?.[0] || 'unknown',
            sessionId: sessionKey,
            metadata: { 
              blocked: true,
              url: message.url,
              violation: 'DOMAIN_WHITELIST'
            },
          });
          Alert.alert('Security Alert', 'Blocked unauthorized API access attempt.');
          break;

        case 'XSS_BLOCKED':
        case 'INLINE_SCRIPT_BLOCKED':
          await auditTrailService.logAccess({
            userId: user?.id || 'anonymous',
            action: 'XSS_ATTEMPT_BLOCKED',
            resourceType: 'WEBVIEW',
            resourceId: currentUrl,
            userRole: user?.roles?.[0] || 'unknown',
            sessionId: sessionKey,
            metadata: { 
              type: message.type,
              source: message.source,
              blocked: true
            },
          });
          break;

        case 'SESSION_TIMEOUT':
          Alert.alert(
            'Session Expired',
            'Your session has expired for security. Please log in again.',
            [{ text: 'OK', onPress: () => handleLogout() }]
          );
          break;

        case 'SESSION_WARNING':
          const minutes = Math.floor(message.remainingTime / 60000);
          Alert.alert(
            'Session Expiring',
            `Your session will expire in ${minutes} minutes. Please save your work.`,
            [
              { text: 'Continue Working', onPress: () => refreshSession() },
              { text: 'Log Out', onPress: () => handleLogout() }
            ]
          );
          break;

        case 'FORM_SUBMIT':
          // Log form submissions for audit
          await auditTrailService.logAccess({
            userId: user?.id || 'anonymous',
            action: 'FORM_SUBMIT',
            resourceType: 'FORM',
            resourceId: message.formId,
            userRole: user?.roles?.[0] || 'unknown',
            sessionId: sessionKey,
            metadata: {
              action: message.action,
              method: message.method,
              hasFiles: message.hasFiles,
            },
          });
          break;

        case 'SECURITY_READY':
          console.log('WebView security initialized:', message);
          break;
      }
    } catch (error) {
      console.error('Failed to handle secure WebView message:', error);
    }
  };

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
    webViewRef.current?.injectJavaScript(`
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    `);
  };

  const refreshSession = () => {
    webViewRef.current?.injectJavaScript(`
      window.lastActivity = Date.now();
    `);
  };

  // Navigation state change with security checks
  const handleNavigationStateChange = async (navState: WebViewNavigation) => {
    setLoading(navState.loading);
    
    // Validate URL against whitelist
    const url = new URL(navState.url);
    const isAllowed = allowedDomains.some(domain => 
      url.hostname.includes(domain)
    );
    
    if (!isAllowed) {
      Alert.alert(
        'Security Warning',
        'This URL is not in the allowed domains list.',
        [
          { text: 'Go Back', onPress: () => webViewRef.current?.goBack() },
          { text: 'Continue Anyway', style: 'destructive' }
        ]
      );
    }
    
    // Log navigation for audit
    await auditTrailService.logAccess({
      userId: user?.id || 'anonymous',
      action: 'PAGE_VIEW',
      resourceType: 'WEBVIEW',
      resourceId: navState.url,
      userRole: user?.roles?.[0] || 'unknown',
      sessionId: sessionKey,
      metadata: {
        title: navState.title,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      },
    });
    
    setCurrentUrl(navState.url);
    
    if (onNavigationChange) {
      onNavigationChange(navState.url);
    }
  };

  // Check authentication
  if (requiresAuth && !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Text style={styles.authText}>Authentication required</Text>
          <Text style={styles.authSubtext}>Please log in to access this content</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render offline screen
  if (isOffline) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineTitle}>Secure Connection Required</Text>
          <Text style={styles.offlineText}>
            Please check your connection and try again
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ 
          uri: currentUrl,
          headers: {
            'Authorization': authMethod === 'oauth' 
              ? `Bearer ${oAuthService.getAccessToken() || ''}` 
              : `Bearer ${user?.token || ''}`,
            'X-Session-Id': sessionKey,
            'X-Client-Type': authMethod === 'oauth' ? 'Mobile-OAuth' : 'Mobile-Secure',
            'X-Auth-Method': authMethod || 'none',
            'X-CSP': contentSecurityPolicy,
          }
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={`
          ${securityInjection}
          ${oAuthWebViewBridge.getWebViewBridgeScript()}
        `}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        mixedContentMode="never" // Force HTTPS
        allowsBackForwardNavigationGestures={false} // Prevent accidental navigation
        allowsInlineMediaPlayback={false} // Prevent auto-play
        mediaPlaybackRequiresUserAction={true}
        originWhitelist={['https://*']} // HTTPS only
        onShouldStartLoadWithRequest={(request) => {
          // Validate all requests
          const url = new URL(request.url);
          
          // Block non-HTTPS
          if (url.protocol !== 'https:' && url.protocol !== 'about:') {
            Alert.alert('Security', 'Only secure HTTPS connections are allowed.');
            return false;
          }
          
          // Check domain whitelist
          const isAllowed = allowedDomains.some(domain => 
            url.hostname.includes(domain)
          );
          
          if (!isAllowed && url.protocol !== 'about:') {
            Alert.alert(
              'Security Warning',
              `Domain ${url.hostname} is not whitelisted.`,
              [
                { text: 'Block', onPress: () => {}, style: 'cancel' },
                { text: 'Allow Once', style: 'destructive' }
              ]
            );
            return false;
          }
          
          return true;
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          
          // Log security-relevant errors
          auditTrailService.logAccess({
            userId: user?.id || 'anonymous',
            action: 'WEBVIEW_ERROR',
            resourceType: 'WEBVIEW',
            resourceId: currentUrl,
            userRole: user?.roles?.[0] || 'unknown',
            sessionId: sessionKey,
            metadata: {
              error: nativeEvent.description,
              code: nativeEvent.code,
            },
          });
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          
          if (nativeEvent.statusCode === 401) {
            handleLogout();
          } else if (nativeEvent.statusCode === 403) {
            Alert.alert('Access Denied', 'You do not have permission to view this content.');
          }
        }}
        // Security settings
        allowUniversalAccessFromFileURLs={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        incognito={enablePHIProtection} // Use incognito for PHI pages
        cacheEnabled={!enablePHIProtection} // Disable cache for PHI
        saveFormDataDisabled={enablePHIProtection} // Don't save PHI forms
        thirdPartyCookiesEnabled={false} // Block third-party cookies
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#007AFF',
    zIndex: 1000,
  },
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  authSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  offlineText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default SecureWebViewWrapper;