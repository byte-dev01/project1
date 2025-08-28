import { SecureStorageService } from './src/services/SecureStorageService';
import { SecureAPIClient } from './src/services/SecureAPIClient';
import { SimpleConsentService } from './src/services/SimpleConsentService';
import { AppState, Platform, NativeModules } from 'react-native';
import { useEffect } from 'react';


export const SecurePrescriptionScreen = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const patientId = 'patient123';
  
  useEffect(() => {
    loadPrescriptions();
  }, []);
  
  const loadPrescriptions = async () => {
    try {
      // 1. Check consent (Required by HIPAA)
      const hasConsent = await SimpleConsentService.hasConsent(patientId);
      if (!hasConsent) {
        const granted = await SimpleConsentService.requestConsent(patientId);
        if (!granted) {
          Alert.alert('Access Denied', 'Consent required');
          navigation.goBack();
          return;
        }
      }
      
      // 2. Fetch over HTTPS (Encryption in transit)
      const data = await SecureAPIClient.get(`/patients/${patientId}/prescriptions`);
      
      // 3. Store encrypted locally (Encryption at rest)
      await SecureStorageService.setSecureItem(
        `prescriptions_${patientId}`,
        data
      );
      
      // 4. Log access for audit
      await auditLog.log({
        action: 'VIEW',
        resourceType: 'PRESCRIPTION',
        patientId,
        userId: currentUser.id
      });
      
      setPrescriptions(data);
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
      Alert.alert('Error', 'Unable to load prescriptions securely');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={prescriptions}
          renderItem={({ item }) => <PrescriptionCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
};