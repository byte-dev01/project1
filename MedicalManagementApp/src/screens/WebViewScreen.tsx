
import React, { useState } from 'react';
import { Alert } from 'react-native';
import WebViewWrapper from '../components/WebViewWrapper';
import { useNavigation } from '@react-navigation/native';

export default function WebViewScreen() {
  const navigation = useNavigation();
  const [currentPath, setCurrentPath] = useState('');

  const handleNavigationChange = (url: string) => {
  const WEBSITE_URL = 'https://healthbridge.up.railway.app/';
    try {
      const urlObj = new URL(WEBSITE_URL);
      const path = urlObj.pathname;
      setCurrentPath(path);

      // Handle specific paths that should open native screens
      switch (path) {
        case '/telehealth/schedule':
          Alert.alert(
            'Schedule Telehealth',
            'Would you like to use the native scheduling feature?',
            [
              { text: 'Stay in Browser', style: 'cancel' },
              { 
                text: 'Use Native', 
                onPress: () => navigation.navigate('Telehealth')
              }
            ]
          );
          break;

        case '/insurance/upload':
          navigation.navigate('Insurance');
          break;

        case '/urgent-care/find':
          navigation.navigate('Urgent Care');
          break;
      }
    } catch (error) {
      console.error('Failed to parse URL:', error);
    }
  };

  return (
    <WebViewWrapper
      baseUrl="https://healthbridge.up.railway.app"
      onNavigationChange={handleNavigationChange}
      enableFileUpload={true}
      enableAuthentication={true}
    />
  );
}