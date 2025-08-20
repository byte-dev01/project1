import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export const LoginScreen: React.FC = () => {
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  
  const { login } = useAuthStore();
  const navigation = useNavigation();

  useEffect(() => {
    checkBiometricAvailability();
    loadClinics();
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
  };

  const handleBiometricLogin = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login with Face ID / Touch ID',
      fallbackLabel: 'Use Password',
    });
    
    if (result.success) {
      // Retrieve stored credentials
      const storedCredentials = await SecureStore.getItemAsync('userCredentials');
      if (storedCredentials) {
        const { username, password, clinicId } = JSON.parse(storedCredentials);
        performLogin(username, password, clinicId);
      }
    }
  };

  const performLogin = async (user: string, pass: string, clinic: string) => {
    setLoading(true);
    try {
      await login(user, pass, clinic);
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>HealthBridge</Text>
          <Text style={styles.subtitle}>Secure Medical Records System</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Your Clinic</Text>
            <Picker
              selectedValue={selectedClinic}
              onValueChange={setSelectedClinic}
              style={styles.picker}
            >
              <Picker.Item label="-- Choose a clinic --" value="" />
              {clinics.map((clinic) => (
                <Picker.Item
                  key={clinic._id}
                  label={clinic.name}
                  value={clinic._id}
                />
              ))}
            </Picker>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username or Email</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => performLogin(username, password, selectedClinic)}
            disabled={loading || !selectedClinic || !username || !password}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {biometricAvailable && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleBiometricLogin}
            >
              <Text style={styles.secondaryButtonText}>
                Login with Face ID / Touch ID
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.securityText}>
            🔒 HIPAA Compliant • Encrypted • Secure
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};