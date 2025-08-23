// ConsentFormScreen.tsx
// src/screens/consent/ConsentFormScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { SignatureCapture } from '../../components/signature/SignatureCapture';
import { ElectronicSignatureService } from '../../core/signature/ElectronicSignatureService';
import { usePatientStore } from '../../stores/usePatientStore';
import { api } from '../../api/client';

interface ConsentForm {
  id: string;
  type: 'procedure' | 'treatment' | 'research' | 'hipaa' | 'financial';
  title: string;
  content: string;
  risks: string[];
  benefits: string[];
  alternatives: string[];
  requiresWitness: boolean;
  expiresInDays?: number;
}

export const ConsentFormScreen: React.FC = () => {
  const [consentForm, setConsentForm] = useState<ConsentForm | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { currentPatient } = usePatientStore();
  const signatureService = ElectronicSignatureService.getInstance();

  useEffect(() => {
    loadConsentForm();
  }, []);

  const loadConsentForm = async () => {
    try {
      // Load consent form for procedure
      const response = await api.get('/consent-forms/procedure-001');
      setConsentForm(response.data);
      
      // Check for existing signatures
      const sigResponse = await api.get(`/signatures/document/${response.data.id}`);
      setSignatures(sigResponse.data);
    } catch (error) {
      console.error('Failed to load consent form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSignature = () => {
    setShowSignature(true);
  };

  const handleSignatureComplete = async (signatureId: string) => {
    setShowSignature(false);
    
    // Check if witness signature is required
    if (consentForm?.requiresWitness) {
      Alert.alert(
        'Witness Required',
        'This consent requires a witness signature. Please have a witness sign now.',
        [
          {
            text: 'Add Witness',
            onPress: () => handleWitnessSignature(signatureId)
          }
        ]
      );
    } else {
      completeConsent([signatureId]);
    }
  };

  const handleWitnessSignature = async (patientSignatureId: string) => {
    // In real app, this would show another signature modal for witness
    Alert.alert('Witness Signature', 'Witness signature flow would appear here');
    completeConsent([patientSignatureId]);
  };

  const completeConsent = async (signatureIds: string[]) => {
    try {
      // Mark consent as complete
      await api.post('/consent-forms/complete', {
        formId: consentForm?.id,
        patientId: currentPatient?.id,
        signatureIds,
        completedAt: new Date().toISOString()
      });

      Alert.alert(
        'Consent Complete',
        'The consent form has been successfully signed and filed.',
        [
          {
            text: 'View PDF',
            onPress: () => downloadSignedPDF(signatureIds[0])
          },
          {
            text: 'Done',
            style: 'default'
          }
        ]
      );

      // Reload to show signed status
      loadConsentForm();

    } catch (error) {
      Alert.alert('Error', 'Failed to complete consent process');
    }
  };

  const downloadSignedPDF = async (signatureId: string) => {
    try {
      const response = await api.get(`/consent-forms/${consentForm?.id}/pdf`, {
        params: { signatureId }
      });
      
      // In real app, would open PDF viewer
      console.log('PDF URL:', response.data.url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const validateAndShowSignature = async () => {
    // Verify patient understands
    Alert.alert(
      'Confirm Understanding',
      'Do you understand the risks, benefits, and alternatives of this procedure?',
      [
        { text: 'No, I have questions', style: 'cancel' },
        { 
          text: 'Yes, I understand',
          onPress: handlePatientSignature
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading consent form...</Text>
      </SafeAreaView>
    );
  }

  const isAlreadySigned = signatures.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{consentForm?.title}</Text>
          <Text style={styles.subtitle}>Informed Consent Document</Text>
        </View>

        {/* Patient Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          <Text style={styles.infoText}>
            Name: {currentPatient?.firstName} {currentPatient?.lastName}
          </Text>
          <Text style={styles.infoText}>
            DOB: {currentPatient?.dateOfBirth}
          </Text>
          <Text style={styles.infoText}>
            MRN: {currentPatient?.mrn}
          </Text>
        </View>

        {/* Consent Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procedure Description</Text>
          <Text style={styles.contentText}>{consentForm?.content}</Text>
        </View>

        {/* Risks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risks and Complications</Text>
          {consentForm?.risks.map((risk, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{risk}</Text>
            </View>
          ))}
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expected Benefits</Text>
          {consentForm?.benefits.map((benefit, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {/* Alternatives */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alternative Options</Text>
          {consentForm?.alternatives.map((alt, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{alt}</Text>
            </View>
          ))}
        </View>

        {/* Important Statements */}
        <View style={[styles.section, styles.importantSection]}>
          <Text style={styles.sectionTitle}>Important Statements</Text>
          <Text style={styles.statementText}>
            ✓ I have read and understood the information provided
          </Text>
          <Text style={styles.statementText}>
            ✓ I have had the opportunity to ask questions
          </Text>
          <Text style={styles.statementText}>
            ✓ All my questions have been answered to my satisfaction
          </Text>
          <Text style={styles.statementText}>
            ✓ I understand I can withdraw consent at any time
          </Text>
          <Text style={styles.statementText}>
            ✓ I voluntarily consent to this procedure
          </Text>
        </View>

        {/* Signature Status */}
        {isAlreadySigned ? (
          <View style={styles.signedContainer}>
            <Text style={styles.signedTitle}>✓ Form Signed</Text>
            {signatures.map((sig, index) => (
              <View key={index} style={styles.signatureInfo}>
                <Text style={styles.signatureText}>
                  {sig.signerName} - {sig.signerTitle || 'Patient'}
                </Text>
                <Text style={styles.signatureTime}>
                  Signed: {new Date(sig.timestamp).toLocaleString()}
                </Text>
                <Text style={styles.signatureId}>
                  ID: {sig.id}
                </Text>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => downloadSignedPDF(signatures[0].id)}
            >
              <Text style={styles.viewButtonText}>View Signed PDF</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.signButton}
              onPress={validateAndShowSignature}
            >
              <Text style={styles.signButtonText}>
                Sign Consent Form
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => Alert.alert('Consent Declined', 'You have declined to provide consent.')}
            >
              <Text style={styles.declineButtonText}>
                Decline Consent
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Signature Modal */}
      {showSignature && consentForm && (
        <SignatureCapture
          visible={showSignature}
          documentId={consentForm.id}
          documentType="consent"
          documentTitle={consentForm.title}
          documentContent={JSON.stringify({
            form: consentForm,
            patient: currentPatient,
            timestamp: new Date().toISOString()
          })}
          signatureType="consent"
          signerName={`${currentPatient?.firstName} ${currentPatient?.lastName}`}
          onSign={handleSignatureComplete}
          onCancel={() => setShowSignature(false)}
          requireWitness={consentForm.requiresWitness}
          customInstructions="By signing below, I acknowledge that I have read, understood, and voluntarily agree to the procedure described above, including its risks, benefits, and alternatives."
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  contentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  importantSection: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  statementText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  actionContainer: {
    padding: 20,
  },
  signButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  signButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  signedContainer: {
    backgroundColor: '#E8F5E9',
    marginTop: 10,
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  signedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 10,
  },
  signatureInfo: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  signatureText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  signatureTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  signatureId: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});