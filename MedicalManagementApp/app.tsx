import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { Alert, AppState, Platform, NativeModules } from 'react-native';

import { RootNavigator } from '@navigation/RootNavigator';
import { useAuthStore } from '@store/authStore';
import { notificationManager } from '@utils/notifications';
import { offlineManager } from '@utils/offline';
import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { LoadingSpinner } from '@components/common/LoadingSpinner';

// If these services live under src/services, prefer your tsconfig path alias:
import { SecureStorageService } from '@/services/SecureStorageService';
import { SecureAPIClient } from '@/services/SecureAPIClient';
// import { SimpleConsentService } from '@/services/SimpleConsentServices';

// Keep splash screen up until we’re ready
SplashScreen.preventAutoHideAsync();

// Register a single notification handler once (module scope is fine)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const { checkAuthStatus } = useAuthStore();

  // One effect that does app init AND returns cleanup for NetInfo
  useEffect(() => {
    let unsubscribeNetInfo: (() => void) | undefined;

    const initializeApp = async () => {
      try {
        // 1) Initial connectivity snapshot
        const netState = await NetInfo.fetch();
        setIsConnected(netState.isConnected);

        // 2) Connectivity listener (with cleanup)
        unsubscribeNetInfo = NetInfo.addEventListener((state) => {
          setIsConnected(state.isConnected);
          if (state.isConnected) {
            offlineManager.syncQueue.process();
          } else {
            Alert.alert(
              'Offline Mode',
              'You are currently offline. Some features may be limited.',
              [{ text: 'OK' }],
            );
          }
        });

        // 3) Auth status
        await checkAuthStatus();
        const authed = useAuthStore.getState().isAuthenticated; // fresh value after await

        // 4) Notifications if authenticated
        if (authed) {
          try {
            await notificationManager.initialize();
            notificationManager.configure();
          } catch (e) {
            console.log('Notification initialization failed:', e);
          }
        }
      } catch (error) {
        console.error('App initialization error:', error);
        Alert.alert('Initialization Error', 'Failed to initialize the app. Please restart.', [{ text: 'OK' }]);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    };

    initializeApp();

    // ✅ Cleanup is returned from useEffect (not from the async function)
    return () => {
      if (unsubscribeNetInfo) unsubscribeNetInfo();
    };
  }, [checkAuthStatus]);

  // Security initialization (separate effect)
  useEffect(() => {
    const initializeSecurity = async () => {
      // 1. Encryption at rest
      await SecureStorageService.initialize();
      console.log('✅ Encryption at rest initialized');

      // 2. HTTPS/TLS client
      SecureAPIClient.initialize('https://api.healthbridge.com');
      console.log('✅ HTTPS/TLS enforced');

      // 3. iOS-specific protections
      if (Platform.OS === 'ios') {
        NativeModules.SecurityEnhancements?.preventScreenshot();

        AppState.addEventListener('change', (next) => {
          if (next === 'inactive' || next === 'background') {
            NativeModules.SecurityEnhancements?.addPrivacyBlur();
          }
        });
      }

      console.log('✅ All security features initialized');
    };

    initializeSecurity();
  }, []);

  if (!isReady) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
