/**
 * OAuth Login Screen for HealthBridge
 * Provides secure OAuth 2.0 authentication flow
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../theme/colors';

export const OAuthLoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const { loginWithOAuth, login, loading, error } = useAuthStore();
  const [authMethod, setAuthMethod] = useState<'oauth' | 'traditional'>('oauth');
  const [traditionalCreds, setTraditionalCreds] = useState({
    username: '',
    password: '',
    clinicId: '',
  });

  const handleOAuthLogin = async () => {
    try {
      await loginWithOAuth();
      // Navigation will be handled by auth state change
    } catch (error: any) {
      Alert.alert(
        'Authentication Failed',
        error.message || 'Unable to authenticate. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTraditionalLogin = async () => {
    const { username, password, clinicId } = traditionalCreds;
    
    if (!username || !password || !clinicId) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    try {
      await login(username, password, clinicId);
      // Navigation will be handled by auth state change
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid credentials. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.primary, theme.primaryDark]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            {/* Logo and Title */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="medical" size={60} color="#fff" />
              </View>
              <Text style={styles.title}>HealthBridge</Text>
              <Text style={styles.subtitle}>Secure Medical Management</Text>
            </View>

            {/* OAuth Login Button */}
            <View style={styles.authSection}>
              <Text style={styles.sectionTitle}>Recommended Sign In</Text>
              
              <TouchableOpacity
                style={[styles.oauthButton, loading && styles.disabledButton]}
                onPress={handleOAuthLogin}
                disabled={loading}
              >
                {loading && authMethod === 'oauth' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={24} color="#fff" />
                    <Text style={styles.oauthButtonText}>
                      Sign in with HealthBridge SSO
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.features}>
                <View style={styles.featureItem}>
                  <Ionicons name="lock-closed" size={16} color="#fff" />
                  <Text style={styles.featureText}>End-to-end encryption</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="finger-print" size={16} color="#fff" />
                  <Text style={styles.featureText}>Biometric authentication</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="shield" size={16} color="#fff" />
                  <Text style={styles.featureText}>HIPAA compliant</Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Traditional Login Option */}
            <TouchableOpacity
              style={styles.traditionalButton}
              onPress={() => {
                // Navigate to traditional login screen or show form
                Alert.alert(
                  'Traditional Login',
                  'Traditional login is available for legacy accounts only. Please use SSO for enhanced security.',
                  [
                    { text: 'Use SSO', style: 'cancel' },
                    { 
                      text: 'Continue Anyway', 
                      onPress: () => {
                        // Navigate to traditional login
                        navigation.navigate('TraditionalLogin' as never);
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.traditionalButtonText}>
                Sign in with username and password
              </Text>
            </TouchableOpacity>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Ionicons name="information-circle" size={20} color="#fff" />
              <Text style={styles.securityText}>
                Your data is encrypted and protected according to HIPAA standards.
                By signing in, you agree to our security policies and terms of service.
              </Text>
            </View>

            {/* Error Display */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  authSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 15,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  oauthButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  disabledButton: {
    opacity: 0.7,
  },
  oauthButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  features: {
    marginTop: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginLeft: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 15,
    fontSize: 14,
  },
  traditionalButton: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
  },
  traditionalButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  securityNotice: {
    flexDirection: 'row',
    marginTop: 40,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  securityText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  errorContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255,0,0,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});