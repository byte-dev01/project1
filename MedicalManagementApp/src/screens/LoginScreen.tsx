import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaWrapper } from '../components/common/SafeAreaWrapper';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { LoginScreenNavigationProp } from '../../types/navigation.types';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { apiClient } from '../api/client';
import { Clinic } from '../../types/models.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { validateLoginForm } from '../../utils/validators';
import { securityManager } from '../services/security';

export const LoginScreen: React.FC = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login, checkAuthStatus } = useAuthStore();
  const navigation = useNavigation<LoginScreenNavigationProp>();

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    // Check if already authenticated
    await checkAuthStatus();
    
    // Check biometric availability
    await checkBiometricAvailability();
    
    // Load clinics
    await loadClinics();
    
    // Check for saved credentials
    await loadSavedCredentials();
  };

  const checkBiometricAvailability = async () => {
    const { available } = await securityManager.checkBiometricAvailability();
    setBiometricAvailable(available);
  };

  const loadClinics = async () => {
    setLoadingClinics(true);
    try {
      const response = await apiClient.get<Clinic[]>('/api/clinics');
      setClinics(response.data);
      
      // If only one clinic, auto-select it
      if (response.data.length === 1) {
        setSelectedClinic(response.data[0]._id);
      }
    } catch (error) {
      console.error('Failed to load clinics:', error);
      Alert.alert('Error', 'Failed to load clinics. Please try again.');
    } finally {
      setLoadingClinics(false);
    }
  };

  const loadSavedCredentials = async () => {
    try {
      const savedUsername = await SecureStore.getItemAsync('saved_username');
      if (savedUsername) {
        setUsername(savedUsername);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Failed to load saved credentials:', error);
    }
  };

  const handleBiometricLogin = async () => {
    const result = await securityManager.authenticateWithBiometrics(
      'Login to HealthBridge'
    );
    
    if (result.success) {
      const storedCredentials = await SecureStore.getItemAsync('userCredentials');
      if (storedCredentials) {
        const { username, password, clinicId } = JSON.parse(storedCredentials);
        await performLogin(username, password, clinicId);
      } else {
        Alert.alert(
          'No Saved Credentials',
          'Please login with your username and password first.'
        );
      }
    }
  };

  const performLogin = async (user: string, pass: string, clinic: string) => {
    // Validate inputs
    const validation = validateLoginForm({
      username: user,
      password: pass,
      clinicId: clinic,
    });
    
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    setLoading(true);
    try {
      await login(user, pass, clinic);
      
      // Save username if remember me is checked
      if (rememberMe) {
        await SecureStore.setItemAsync('saved_username', user);
      } else {
        await SecureStore.deleteItemAsync('saved_username');
      }
      
      // Save credentials for biometric login
      if (biometricAvailable) {
        await SecureStore.setItemAsync(
          'userCredentials',
          JSON.stringify({ username: user, password: pass, clinicId: clinic })
        );
      }
      
      // Start session timer
      securityManager.startSessionTimer(() => {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [{ text: 'OK', onPress: () => navigation.replace('Login') }]
        );
      });
      
      // Navigate to main app
      navigation.replace('Main' as any);
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.response?.data?.message || 'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword' as any);
  };

  const formatClinicAddress = (clinic: Clinic): string => {
    const { address } = clinic;
    if (!address) return '';
    return `${address.city}, ${address.state}`;
  };

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo and Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>🏥</Text>
            </View>
            <Text style={styles.title}>HealthBridge</Text>
            <Text style={styles.subtitle}>Secure Medical Records System</Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            {/* Clinic Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Your Clinic</Text>
              {loadingClinics ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                </View>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedClinic}
                    onValueChange={setSelectedClinic}
                    style={styles.picker}
                  >
                    <Picker.Item 
                      label="-- Choose a clinic --" 
                      value="" 
                      color={colors.text.tertiary}
                    />
                    {clinics.map((clinic) => (
                      <Picker.Item
                        key={clinic._id}
                        label={`${clinic.name} - ${formatClinicAddress(clinic)}`}
                        value={clinic._id}
                      />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username or Email</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your username or email"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me & Forgot Password */}
            <View style={styles.options}>
              <TouchableOpacity
                style={styles.rememberMe}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                (loading || !selectedClinic || !username || !password) && styles.buttonDisabled
              ]}
              onPress={() => performLogin(username, password, selectedClinic)}
              disabled={loading || !selectedClinic || !username || !password}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Biometric Login */}
            {biometricAvailable && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>
                
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleBiometricLogin}
                >
                  <Text style={styles.secondaryButtonText}>
                    Login with Face ID / Touch ID
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Demo Login (Development Only) */}
            {__DEV__ && (
              <TouchableOpacity
                style={[styles.button, styles.demoButton]}
                onPress={() => {
                  setUsername('demo@example.com');
                  setPassword('demo123');
                  if (clinics.length > 0) {
                    setSelectedClinic(clinics[0]._id);
                  }
                }}
              >
                <Text style={styles.demoButtonText}>Fill Demo Credentials</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.securityText}>
              🔒 HIPAA Compliant • Encrypted • Secure
            </Text>
            <View style={styles.links}>
              <TouchableOpacity>
                <Text style={styles.link}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.linkSeparator}>•</Text>
              <TouchableOpacity>
                <Text style={styles.link}>Terms of Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  form: {
    marginTop: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
  },
  passwordInput: {
    paddingRight: spacing['2xl'] + spacing.md,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: spacing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background.primary,
  },
  picker: {
    height: 50,
  },
  loadingContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: spacing.borderRadius.md,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.border.medium,
    borderRadius: spacing.borderRadius.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checkmark: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },
  rememberMeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  forgotPassword: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
    ...spacing.shadow.md,
  },
  buttonDisabled: {
    backgroundColor: colors.gray[300],
    shadowOpacity: 0,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryButton: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  demoButton: {
    backgroundColor: colors.secondary[100],
  },
  demoButtonText: {
    color: colors.secondary[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  securityText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  link: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  linkSeparator: {
    marginHorizontal: spacing.sm,
    color: colors.text.tertiary,
  },
});

