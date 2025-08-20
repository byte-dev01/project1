import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { insuranceAPI } from '../../api/InsuranceApi';

interface InsuranceFormData {
  patientName: string;
  dateOfBirth: Date;
  insuranceCompany: string;
  insuranceNumber: string;
  policyNumber: string;
  groupNumber: string;
  reasonForVisit: string;
}

export const InsuranceForm: React.FC = () => {
  const [formData, setFormData] = useState<InsuranceFormData>({
    patientName: '',
    dateOfBirth: new Date(),
    insuranceCompany: '',
    insuranceNumber: '',
    policyNumber: '',
    groupNumber: '',
    reasonForVisit: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePrefill = async () => {
    setLoading(true);
    try {
      const prefilledData = await insuranceAPI.prefill(formData.insuranceNumber);
      setFormData({ ...formData, ...prefilledData });
    } catch (error) {
      Alert.alert('Error', 'Unable to prefill insurance information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await insuranceAPI.submit(formData);
      Alert.alert('Success', 'Insurance form submitted successfully');
      // Reset form or navigate away
    } catch (error) {
      Alert.alert('Error', 'Failed to submit insurance form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Patient Information</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Patient Name / 名字"
          value={formData.patientName}
          onChangeText={(text) => setFormData({ ...formData, patientName: text })}
        />

        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Text>Date of Birth / 生日: {formData.dateOfBirth.toLocaleDateString()}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={formData.dateOfBirth}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setFormData({ ...formData, dateOfBirth: date });
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insurance Information</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Insurance Company / 保险公司"
          value={formData.insuranceCompany}
          onChangeText={(text) => setFormData({ ...formData, insuranceCompany: text })}
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Insurance Number / 保险号"
            value={formData.insuranceNumber}
            onChangeText={(text) => setFormData({ ...formData, insuranceNumber: text })}
          />
          <TouchableOpacity
            style={styles.prefillButton}
            onPress={handlePrefill}
            disabled={loading || !formData.insuranceNumber}
          >
            <Text style={styles.prefillButtonText}>Prefill</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Policy Number / 保单号"
          value={formData.policyNumber}
          onChangeText={(text) => setFormData({ ...formData, policyNumber: text })}
        />

        <TextInput
          style={styles.input}
          placeholder="Group Number (Optional)"
          value={formData.groupNumber}
          onChangeText={(text) => setFormData({ ...formData, groupNumber: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visit Information</Text>
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Reason for Visit / 来访原因"
          value={formData.reasonForVisit}
          onChangeText={(text) => setFormData({ ...formData, reasonForVisit: text })}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Submitting...' : 'Submit Form'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};