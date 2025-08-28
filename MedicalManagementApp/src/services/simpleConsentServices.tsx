import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export class SimpleConsentService {
  private static CONSENT_KEY_PREFIX = 'patient_consent_';
  
  /**
   * Show consent dialog and store response
   * This is ALL you need for MVP compliance
   */
  static async requestConsent(patientId: string): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Medical Records Access',
        'Do you consent to viewing your medical records through this app? Your data will be protected according to HIPAA guidelines.',
        [
          {
            text: 'Decline',
            onPress: async () => {
              await this.storeConsent(patientId, false);
              resolve(false);
            },
            style: 'cancel'
          },
          {
            text: 'I Consent',
            onPress: async () => {
              await this.storeConsent(patientId, true);
              resolve(true);
            }
          }
        ],
        { cancelable: false }
      );
    });
  }
  
  /**
   * Check if patient has consented
   */
  static async hasConsent(patientId: string): Promise<boolean> {
    try {
      const consent = await AsyncStorage.getItem(
        `${this.CONSENT_KEY_PREFIX}${patientId}`
      );
      return consent === 'true';
    } catch {
      return false;
    }
  }
  
  /**
   * Store consent with timestamp
   */
  private static async storeConsent(patientId: string, consented: boolean): Promise<void> {
    const consentRecord = {
      patientId,
      consented,
      timestamp: Date.now(),
      version: '1.0' // Track consent version for compliance
    };
    
    await AsyncStorage.setItem(
      `${this.CONSENT_KEY_PREFIX}${patientId}`,
      consented.toString()
    );
    
    // Store detailed record for audit
    await AsyncStorage.setItem(
      `${this.CONSENT_KEY_PREFIX}${patientId}_record`,
      JSON.stringify(consentRecord)
    );
  }
  
  /**
   * Revoke consent
   */
  static async revokeConsent(patientId: string): Promise<void> {
    await this.storeConsent(patientId, false);
  }
}

// Usage in your screens:
export const PrescriptionScreen = ({ patientId }) => {
  const [hasConsent, setHasConsent] = useState(false);
  
  useEffect(() => {
    checkConsent();
  }, []);
  
  const checkConsent = async () => {
    // Check existing consent
    let consented = await SimpleConsentService.hasConsent(patientId);
    
    // If no consent, request it
    if (!consented) {
      consented = await SimpleConsentService.requestConsent(patientId);
    }
    
    setHasConsent(consented);
    
    if (!consented) {
      Alert.alert('Access Denied', 'Consent required to view medical records');
      navigation.goBack();
    }
  };
  
  if (!hasConsent) {
    return <Text>Checking consent...</Text>;
  }
  
  // Show prescriptions only after consent
  return <PrescriptionList patientId={patientId} />;
};
