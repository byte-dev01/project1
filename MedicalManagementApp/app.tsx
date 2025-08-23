import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

import { RootNavigator } from '@navigation/RootNavigator';
import { useAuthStore } from '@store/authStore';
import { notificationManager } from '@utils/notifications';
import { offlineManager } from '@utils/offline';
import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { LoadingSpinner } from '@components/common/LoadingSpinner';
import { SecureStorageService } from '../SecureStorageService';
import { SecureAPIClient } from './src/services/SecureAPIClient';
import { SimpleConsentService } from './src/services/simpleConsentServices';
import { AppState, Platform, NativeModules } from 'react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { checkAuthStatus, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);
  
  useEffect(() => {
  let unsubscribe: (() => void) | undefined;

  const initializeApp = async () => {
    try {
      // Check network connectivity
      const netState = await NetInfo.fetch();
      setIsConnected(netState.isConnected);

      // Set up network listener
      const unsubscribe = NetInfo.addEventListener(state => {
        setIsConnected(state.isConnected);
        if (state.isConnected) {
          // Process offline sync queue when connection restored
          offlineManager.syncQueue.process();
        } else {
          // Show offline alert
          Alert.alert(
            'Offline Mode',
            'You are currently offline. Some features may be limited.',
            [{ text: 'OK' }]
          );
        }
      });
  };


      // Check authentication status
      await checkAuthStatus();

      // Initialize notifications if authenticated
      if (isAuthenticated) {
        try {
          await notificationManager.initialize();
          notificationManager.configure();
        } catch (error) {
          console.log('Notification initialization failed:', error);
        }
      }

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

    } catch (error) {
      console.error('App initialization error:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please restart.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsReady(true);
      await SplashScreen.hideAsync();
    }
    initializeApp();

    return () => {
    if (unsubscribe) unsubscribe();

  };

  if (!isReady) {
    return <LoadingSpinner fullScreen />;
  }

  useEffect(() => {
    initializeSecurity();
  }, []);
  
  const initializeSecurity = async () => {
    // 1. Initialize encryption
    await SecureStorageService.initialize();
    console.log('✅ Encryption at rest initialized');
    
    // 2. Initialize HTTPS client
    SecureAPIClient.initialize('https://api.healthbridge.com');
    console.log('✅ HTTPS/TLS enforced');
    
    // 3. iOS-specific security
    if (Platform.OS === 'ios') {
      // Prevent screenshots
      NativeModules.SecurityEnhancements?.preventScreenshot();
      
      // Add blur on background
      AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'inactive' || nextAppState === 'background') {
          NativeModules.SecurityEnhancements?.addPrivacyBlur();
        }
      });
    }
    
    console.log('✅ All security features initialized');
  };

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <StatusBar style="auto" />
        <RootNavigator />
        {/* Show offline status if needed - Alert.alert() should be called, not rendered as JSX */}
      </NavigationContainer>
    </ErrorBoundary>
  );
}
