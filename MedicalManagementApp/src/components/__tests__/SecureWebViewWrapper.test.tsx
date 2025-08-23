import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import SecureWebViewWrapper from '../SecureWebViewWrapper';
import { useAuth } from '../../hooks/useAuth';
import { logAuditEvent } from '../../core/compliance/AuditTrail';

// Mock dependencies
jest.mock('react-native-webview');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../hooks/useAuth');
jest.mock('../../core/compliance/AuditTrail');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
  canOpenURL: jest.fn().mockResolvedValue(true),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

const mockRoute = {
  params: {
    url: 'https://medical.example.com/patient',
    title: 'Patient Portal',
  },
};

describe('SecureWebViewWrapper', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    token: 'test-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Component Rendering', () => {
    it('should render WebView with secure configuration', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      expect(webView).toBeDefined();
      expect(webView.props.javaScriptEnabled).toBe(true);
      expect(webView.props.domStorageEnabled).toBe(true);
      expect(webView.props.mixedContentMode).toBe('never');
      expect(webView.props.allowsInlineMediaPlayback).toBe(false);
    });

    it('should inject security scripts on load', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const injectedScript = webView.props.injectedJavaScript;

      expect(injectedScript).toContain('Content-Security-Policy');
      expect(injectedScript).toContain('localStorage.getItem');
      expect(injectedScript).toContain('sessionTimeout');
    });

    it('should show loading indicator while loading', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      fireEvent(webView, 'loadStart');

      expect(getByTestId('loading-indicator')).toBeDefined();
    });
  });

  describe('PHI Protection', () => {
    it('should prevent copying SSN patterns', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'copyAttempt',
            data: '123-45-6789',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'PHI_COPY_BLOCKED',
            category: 'SECURITY',
          })
        );
      });
    });

    it('should prevent copying MRN patterns', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'copyAttempt',
            data: 'MRN-123456',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'PHI_COPY_BLOCKED',
            category: 'SECURITY',
          })
        );
      });
    });

    it('should allow copying non-PHI content', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'copyAttempt',
            data: 'Regular text content',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(logAuditEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'PHI_COPY_BLOCKED',
          })
        );
      });
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout warning', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'sessionWarning',
            timeRemaining: 60,
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Session Expiring',
          expect.stringContaining('60 seconds'),
          expect.any(Array)
        );
      });
    });

    it('should handle session expired', async () => {
      const mockLogout = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
      });

      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'sessionExpired',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
      });
    });

    it('should extend session on user activity', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      
      // Simulate user activity
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'userActivity',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      // Should inject script to reset session timer
      await waitFor(() => {
        const injectedScript = webView.props.injectedJavaScriptBeforeContentLoaded;
        expect(injectedScript).toBeDefined();
      });
    });
  });

  describe('Domain Whitelisting', () => {
    it('should allow navigation to whitelisted domains', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const request = {
        url: 'https://medical.example.com/dashboard',
      };

      const shouldStart = webView.props.onShouldStartLoadWithRequest(request);
      expect(shouldStart).toBe(true);
    });

    it('should block navigation to non-whitelisted domains', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const request = {
        url: 'https://malicious.com/phishing',
      };

      const shouldStart = webView.props.onShouldStartLoadWithRequest(request);
      expect(shouldStart).toBe(false);
      
      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'DOMAIN_BLOCKED',
            category: 'SECURITY',
            details: expect.objectContaining({
              url: 'https://malicious.com/phishing',
            }),
          })
        );
      });
    });

    it('should enforce HTTPS for all requests', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const request = {
        url: 'http://medical.example.com/dashboard',
      };

      const shouldStart = webView.props.onShouldStartLoadWithRequest(request);
      expect(shouldStart).toBe(false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Security Warning',
          expect.stringContaining('secure connection')
        );
      });
    });
  });

  describe('XSS Prevention', () => {
    it('should detect and block XSS attempts', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'xssDetected',
            payload: '<script>alert("XSS")</script>',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'XSS_BLOCKED',
            category: 'SECURITY',
            severity: 'HIGH',
          })
        );
      });
    });

    it('should sanitize injected scripts', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const injectedScript = webView.props.injectedJavaScript;

      // Check for XSS prevention code
      expect(injectedScript).toContain('MutationObserver');
      expect(injectedScript).toContain('script-src');
    });
  });

  describe('Audit Logging', () => {
    it('should log page load events', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      fireEvent(webView, 'load');

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'WEBVIEW_LOAD',
            category: 'ACCESS',
            details: expect.objectContaining({
              url: mockRoute.params.url,
            }),
          })
        );
      });
    });

    it('should log navigation events', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const navState = {
        url: 'https://medical.example.com/newpage',
        title: 'New Page',
      };

      fireEvent(webView, 'navigationStateChange', navState);

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'WEBVIEW_NAVIGATE',
            category: 'ACCESS',
            details: expect.objectContaining({
              url: navState.url,
            }),
          })
        );
      });
    });

    it('should log error events', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const error = {
        nativeEvent: {
          description: 'Network error',
          code: 'NETWORK_ERROR',
        },
      };

      fireEvent(webView, 'error', error);

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'WEBVIEW_ERROR',
            category: 'ERROR',
            severity: 'MEDIUM',
            details: expect.objectContaining({
              error: error.nativeEvent.description,
            }),
          })
        );
      });
    });
  });

  describe('Encrypted Storage', () => {
    it('should encrypt sensitive data before storage', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'storeData',
            key: 'patientData',
            value: 'sensitive-info',
            encrypt: true,
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalled();
        const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
        const storedValue = calls[0][1];
        expect(storedValue).not.toBe('sensitive-info'); // Should be encrypted
      });
    });

    it('should decrypt data when retrieving', async () => {
      const encryptedData = 'encrypted-value';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(encryptedData);

      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'getData',
            key: 'patientData',
            decrypt: true,
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('patientData');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle WebView load errors gracefully', () => {
      const { getByTestId, getByText } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      fireEvent(webView, 'error', {
        nativeEvent: {
          description: 'Could not connect to server',
        },
      });

      expect(getByText(/Could not load page/)).toBeDefined();
      expect(getByText(/Could not connect to server/)).toBeDefined();
    });

    it('should provide retry functionality on error', async () => {
      const { getByTestId, getByText } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      fireEvent(webView, 'error', {
        nativeEvent: {
          description: 'Network error',
        },
      });

      const retryButton = getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        const reloadedWebView = getByTestId('secure-webview');
        expect(reloadedWebView.props.source.uri).toBe(mockRoute.params.url);
      });
    });
  });

  describe('Screenshot Prevention', () => {
    it('should prevent screenshots on sensitive pages', async () => {
      const sensitiveRoute = {
        params: {
          url: 'https://medical.example.com/patient/records',
          title: 'Patient Records',
          preventScreenshot: true,
        },
      };

      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={sensitiveRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      
      // Check that screenshot prevention is applied
      expect(webView.props.androidHardwareAccelerationDisabled).toBe(true);
    });
  });

  describe('Content Security Policy', () => {
    it('should apply CSP headers correctly', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const injectedScript = webView.props.injectedJavaScript;

      expect(injectedScript).toContain("default-src 'self'");
      expect(injectedScript).toContain("script-src 'self' 'unsafe-inline'");
      expect(injectedScript).toContain('upgrade-insecure-requests');
    });

    it('should block inline scripts without nonce', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <SecureWebViewWrapper navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>
      );

      const webView = getByTestId('secure-webview');
      const message = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'cspViolation',
            violatedDirective: 'script-src',
            blockedURI: 'inline',
          }),
        },
      };

      fireEvent(webView, 'message', message);

      await waitFor(() => {
        expect(logAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CSP_VIOLATION',
            category: 'SECURITY',
            severity: 'HIGH',
          })
        );
      });
    });
  });
});