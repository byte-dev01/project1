import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  View,
  Text
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SecureStorageService } from '../services/SecureStorageService';
import { SecureAPIClient } from '../services/SecureAPIClient';
import { SimpleConsentService } from '../services/simpleConsentServices';
import { auditTrailService } from '../core/compliance/AuditTrail';
import { useAuthStore } from '@store/authStore';

interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  date: string;
}

interface PrescriptionCardProps {
  item: Prescription;
}

const PrescriptionCard: React.FC<PrescriptionCardProps> = ({ item }) => {
  return (
    <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.medication}</Text>
      <Text>{item.dosage} - {item.frequency}</Text>
      <Text style={{ fontSize: 12, color: '#666' }}>
        Prescribed by: {item.prescribedBy} on {item.date}
      </Text>
    </View>
  );
};

export const SecurePrescriptionScreen: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const patientId = 'patient123'; // This should come from navigation params
  
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
      await auditTrailService.logAccess({
        action: 'VIEW',
        resourceType: 'PRESCRIPTION',
        resourceId: 'all',
        patientId,
        userId: user?.id || 'unknown',
        userRole: user?.roles?.[0] || 'unknown',
        sessionId: 'current-session'
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
    <SafeAreaView style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PrescriptionCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
};