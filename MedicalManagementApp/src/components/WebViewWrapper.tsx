import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Platform,
  StatusBar,
  SafeAreaView,
  BackHandler,
  Linking,
  Share,
  RefreshControl
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';

interface WebViewWrapperProps {
  baseUrl?: string;
  onNavigationChange?: (url: string) => void;
  enableFileUpload?: boolean;
  enableAuthentication?: boolean;
}

export const WebViewWrapper: React.FC<WebViewWrapperProps> = ({
  baseUrl = 'https://healthbridge.up.railway.app',
  onNavigationChange,
  enableFileUpload = true,
  enableAuthentication = true
}) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(baseUrl);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileUploadCallback = useRef<any>(null);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [canGoBack]);

  // Load auth token
  useEffect(() => {
    loadAuthToken();
  }, []);

  const loadAuthToken = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      setAuthToken(token);
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  };

  // JavaScript to inject into the WebView
  const injectedJavaScript = `
    (function() {
      // Override console for debugging
      const originalConsole = window.console;
      window.console = {
        ...originalConsole,
        log: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CONSOLE_LOG',
            data: Array.from(arguments).map(arg => String(arg)).join(' ')
          }));
          originalConsole.log.apply(originalConsole, arguments);
        }
      };

      // Handle authentication
      ${enableAuthentication ? `
        // Check for existing auth token
        const storedToken = localStorage.getItem('authToken');
        if (storedToken) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_TOKEN_FOUND',
            token: storedToken
          }));
        }

        // Inject auth token if provided by native
        const nativeToken = '${authToken || ''}';
        if (nativeToken && !storedToken) {
          localStorage.setItem('authToken', nativeToken);
          // Trigger a refresh if needed
          if (window.location.pathname === '/login') {
            window.location.href = '/dashboard';
          }
        }

        // Monitor auth changes
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
          if (key === 'authToken') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUTH_TOKEN_CHANGED',
              token: value
            }));
          }
          return originalSetItem.apply(this, arguments);
        };

        // Monitor logout
        const originalRemoveItem = localStorage.removeItem;
        localStorage.removeItem = function(key) {
          if (key === 'authToken') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUTH_LOGOUT'
            }));
          }
          return originalRemoveItem.apply(this, arguments);
        };
      ` : ''}

      // File upload handling
      ${enableFileUpload ? `
        // Override file input clicks
        document.addEventListener('click', function(e) {
          const target = e.target;
          if (target.tagName === 'INPUT' && target.type === 'file') {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FILE_UPLOAD_REQUEST',
              accept: target.accept || '*/*',
              multiple: target.multiple || false,
              inputId: target.id || Math.random().toString(36).substr(2, 9)
            }));
          }
        }, true);
      ` : ''}

      // Handle special links
      document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target) {
          const href = target.href;
          
          // Handle tel: links
          if (href && href.startsWith('tel:')) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TEL_LINK',
              number: href.replace('tel:', '')
            }));
          }
          
          // Handle mailto: links
          if (href && href.startsWith('mailto:')) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAILTO_LINK',
              email: href.replace('mailto:', '')
            }));
          }
          
          // Handle external links
          if (href && !href.includes('${baseUrl}')) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EXTERNAL_LINK',
              url: href
            }));
          }
        }
      });

      // Handle form submissions
      document.addEventListener('submit', function(e) {
        const form = e.target;
        const formData = new FormData(form);
        
        // Track important form submissions
        if (form.id === 'insurance-upload' || form.classList.contains('insurance-form')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'INSURANCE_FORM_SUBMIT',
            action: form.action,
            method: form.method
          }));
        }
      });

      // Detect page changes that might need native handling
      const observer = new MutationObserver(function(mutations) {
        // Check if we're on a page that needs native features
        if (window.location.pathname === '/telehealth/room') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'TELEHEALTH_ROOM_ENTERED'
          }));
        }
        
        if (window.location.pathname === '/prescriptions/new') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PRESCRIPTION_PAGE'
          }));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Send ready signal
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'WEBVIEW_READY',
        url: window.location.href
      }));

      // Prevent text selection on iOS for better UX
      if (${Platform.OS === 'ios'}) {
        document.documentElement.style.webkitUserSelect = 'none';
        document.documentElement.style.webkitTouchCallout = 'none';
      }

      true; // Required for injection
    })();
  `;

  // Handle messages from WebView
  const handleMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'CONSOLE_LOG':
          console.log('[WebView]:', message.data);
          break;

        case 'AUTH_TOKEN_FOUND':
        case 'AUTH_TOKEN_CHANGED':
          await AsyncStorage.setItem('authToken', message.token);
          setAuthToken(message.token);
          break;

        case 'AUTH_LOGOUT':
          await AsyncStorage.removeItem('authToken');
          setAuthToken(null);
          // Navigate to login page
          webViewRef.current?.injectJavaScript(`
            window.location.href = '/login';
          `);
          break;

        case 'FILE_UPLOAD_REQUEST':
          handleFileUpload(message);
          break;

        case 'TEL_LINK':
          Linking.openURL(`tel:${message.number}`);
          break;

        case 'MAILTO_LINK':
          Linking.openURL(`mailto:${message.email}`);
          break;

        case 'EXTERNAL_LINK':
          handleExternalLink(message.url);
          break;

        case 'TELEHEALTH_ROOM_ENTERED':
          Alert.alert(
            'Telehealth Session',
            'For the best experience, would you like to use the native video feature?',
            [
              { text: 'Continue in Browser', style: 'cancel' },
              { text: 'Use Native', onPress: () => launchNativeTelehealth() }
            ]
          );
          break;

        case 'PRESCRIPTION_PAGE':
          // Inject additional safety checks for prescriptions
          webViewRef.current?.injectJavaScript(`
            window.checkDrugInteractions = function(medication, currentMeds) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CHECK_DRUG_INTERACTIONS',
                medication: medication,
                currentMeds: currentMeds
              }));
            };
          `);
          break;

        case 'CHECK_DRUG_INTERACTIONS':
          // Handle drug interaction check
          checkDrugInteractions(message.medication, message.currentMeds);
          break;

        case 'INSURANCE_FORM_SUBMIT':
          console.log('Insurance form submitted:', message);
          break;

        case 'WEBVIEW_READY':
          console.log('WebView ready at:', message.url);
          break;
      }
    } catch (error) {
      console.error('Failed to handle WebView message:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (request: any) => {
    try {
      const options: any = {
        type: DocumentPicker.types.allFiles,
        allowMultiSelection: request.multiple
      };

      if (request.accept.includes('image')) {
        options.type = DocumentPicker.types.images;
      } else if (request.accept.includes('pdf')) {
        options.type = DocumentPicker.types.pdf;
      }

      const results = await DocumentPicker.pick(options);
      
      // Show upload progress
      setUploadProgress(0);

      for (const file of results) {
        // Read file as base64
        const base64 = await RNFS.readFile(file.uri, 'base64');
        
        // Send file to WebView
        const script = `
          (function() {
            // Find the input element
            const input = document.getElementById('${request.inputId}') || 
                         document.querySelector('input[type="file"]');
            
            if (input) {
              // Create a File object
              const byteCharacters = atob('${base64}');
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const file = new File([byteArray], '${file.name}', { type: '${file.type}' });
              
              // Create a DataTransfer to hold the file
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              
              // Assign the files to the input
              input.files = dataTransfer.files;
              
              // Trigger change event
              const event = new Event('change', { bubbles: true });
              input.dispatchEvent(event);
              
              // Also trigger any React events
              const reactEvent = new Event('input', { bubbles: true });
              input.dispatchEvent(reactEvent);
            }
          })();
        `;
        
        webViewRef.current?.injectJavaScript(script);
        
        // Update progress
        setUploadProgress((prev) => prev + (100 / results.length));
      }

      // Reset progress after delay
      setTimeout(() => setUploadProgress(0), 2000);

    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Upload Failed', 'Failed to select file. Please try again.');
        console.error('File upload error:', error);
      }
    }
  };

  // Handle external links
  const handleExternalLink = (url: string) => {
    Alert.alert(
      'External Link',
      'This link will open outside the app. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(url) }
      ]
    );
  };

  // Launch native telehealth
  const launchNativeTelehealth = () => {
    // Navigate to native telehealth screen
    // This would be handled by navigation prop in real implementation
    Alert.alert('Native Telehealth', 'Launching native video feature...');
  };

  // Check drug interactions
  const checkDrugInteractions = async (medication: string, currentMeds: string[]) => {
    // This would call your drug interaction service
    const interactions = await checkDrugInteractionAPI(medication, currentMeds);
    
    // Send results back to WebView
    webViewRef.current?.injectJavaScript(`
      window.drugInteractionResults = ${JSON.stringify(interactions)};
      if (window.onDrugInteractionResults) {
        window.onDrugInteractionResults(window.drugInteractionResults);
      }
    `);
  };

  // Navigation state change
  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    setLoading(navState.loading);
    
    if (onNavigationChange) {
      onNavigationChange(navState.url);
    }

    // Handle specific URLs
    if (navState.url.includes('/logout')) {
      AsyncStorage.removeItem('authToken');
      setAuthToken(null);
    }
  };

  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    webViewRef.current?.reload();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Share current page
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this page: ${currentUrl}`,
        url: currentUrl,
        title: 'Share from HealthBridge'
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Render offline screen
  if (isOffline) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.offlineContainer}>
          <Icon name="wifi-off" size={64} color="#999" />
          <Text style={styles.offlineTitle}>No Internet Connection</Text>
          <Text style={styles.offlineText}>
            Please check your connection and try again
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              NetInfo.fetch().then(state => {
                setIsOffline(!state.isConnected);
                if (state.isConnected) {
                  webViewRef.current?.reload();
                }
              });
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Navigation Bar */}
      <View style={styles.navigationBar}>
        <TouchableOpacity 
          onPress={() => webViewRef.current?.goBack()}
          disabled={!canGoBack}
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
        >
          <Icon name="arrow-back" size={24} color={canGoBack ? '#007AFF' : '#ccc'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => webViewRef.current?.goForward()}
          disabled={!canGoForward}
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
        >
          <Icon name="arrow-forward" size={24} color={canGoForward ? '#007AFF' : '#ccc'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleRefresh}
          style={styles.navButton}
        >
          <Icon name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.urlContainer}>
          <Icon name="lock" size={16} color="#4CAF50" />
          <Text style={styles.urlText} numberOfLines={1}>
            {currentUrl.replace('https://', '').replace('http://', '')}
          </Text>
        </View>
        
        <TouchableOpacity 
          onPress={handleShare}
          style={styles.navButton}
        >
          <Icon name="share" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      {loading && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
      )}

      {/* Upload Progress */}
      {uploadProgress > 0 && (
        <View style={styles.uploadProgressContainer}>
          <Text style={styles.uploadProgressText}>Uploading... {Math.round(uploadProgress)}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ 
          uri: currentUrl,
          headers: authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : {}
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="always"
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => {
          // Handle custom URL schemes
          if (request.url.startsWith('tel:') || 
              request.url.startsWith('mailto:') ||
              request.url.startsWith('maps:') ||
              request.url.startsWith('geo:')) {
            Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading HealthBridge...</Text>
          </View>
        )}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          Alert.alert(
            'Error',
            'Failed to load page. Please try again.',
            [
              { text: 'Retry', onPress: () => webViewRef.current?.reload() },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('HTTP error:', nativeEvent);
          if (nativeEvent.statusCode === 401) {
            // Handle authentication error
            AsyncStorage.removeItem('authToken');
            setAuthToken(null);
          }
        }}
        onContentProcessDidTerminate={() => {
          // Reload on crash
          webViewRef.current?.reload();
        }}
        // iOS specific
        allowsLinkPreview={true}
        automaticallyAdjustContentInsets={false}
        bounces={true}
        dataDetectorTypes="all"
        decelerationRate="normal"
        directionalLockEnabled={false}
        // Android specific
        androidHardwareAccelerationDisabled={false}
        cacheEnabled={true}
        overScrollMode="always"
        saveFormDataDisabled={false}
        thirdPartyCookiesEnabled={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  urlContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginHorizontal: 10,
    height: 32,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  urlText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    color: '#666',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#e0e0e0',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
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
    marginTop: 20,
  },
  offlineText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 30,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadProgressContainer: {
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  uploadProgressText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
});

// Helper function for API calls
async function checkDrugInteractionAPI(medication: string, currentMeds: string[]) {
  // Mock implementation - replace with actual API call
  return {
    hasInteractions: false,
    interactions: [],
    warnings: []
  };
}

export default WebViewWrapper;