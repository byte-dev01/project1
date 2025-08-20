import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';
import { Picker } from '@react-native-picker/picker';
import { Patient } from '../../../types/models.types';
import { patientsAPI } from '../../api/patients';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { validatePatientForm, validatePhone, validateEmail } from '../../utils/validators';
import { formatDate, formatPhoneNumber } from '../../../utils/helpers';

interface PatientFormData {
  firstName: string;
  lastName: string;
  legalName?: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  phone: string;
  email?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  hasInsurance: boolean;
}

interface PatientFormProps {
  patient?: Patient;
  onSubmit?: (data: Patient) => void;
  onCancel?: () => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  patient,
  onSubmit,
  onCancel,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const isEditMode = !!patient;

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PatientFormData>({
    defaultValues: {
      firstName: patient?.firstName || '',
      lastName: patient?.lastName || '',
      legalName: patient?.legalName || '',
      dateOfBirth: patient?.dateOfBirth ? new Date(patient.dateOfBirth) : new Date(),
      gender: patient?.gender || 'male',
      phone: patient?.contact?.phone || '',
      email: patient?.contact?.email || '',
      address: {
        street: patient?.contact?.address?.street || '',
        city: patient?.contact?.address?.city || '',
        state: patient?.contact?.address?.state || '',
        zip: patient?.contact?.address?.zip || '',
      },
      emergencyContact: {
        name: patient?.emergencyContact?.phone ? 
          `${patient.emergencyContact.phone}` : '',
        phone: patient?.emergencyContact?.phone || '',
        relationship: '',
      },
      hasInsurance: !!patient?.insurance,
    },
  });

  const hasInsurance = watch('hasInsurance');

  const onFormSubmit = async (data: PatientFormData) => {
    setLoading(true);
    try {
      const patientData: Partial<Patient> = {
        firstName: data.firstName,
        lastName: data.lastName,
        legalName: data.legalName,
        dateOfBirth: data.dateOfBirth.toISOString(),
        gender: data.gender,
        contact: {
          phone: data.phone.replace(/\D/g, ''),
          email: data.email,
          address: data.address,
        },
        emergencyContact: data.emergencyContact.name ? {
          phone: data.emergencyContact.phone.replace(/\D/g, ''),
          email: '', // Add email field if needed
        } : undefined,
      };

      let result: Patient;
      if (isEditMode) {
        result = await patientsAPI.updatePatient(patient.id, patientData);
      } else {
        result = await patientsAPI.createPatient(patientData);
      }

      if (onSubmit) {
        await onSubmit(result);
      } else {
        Alert.alert(
          'Success',
          `Patient ${isEditMode ? 'updated' : 'created'} successfully`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'create'} patient`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <Controller
            control={control}
            name="firstName"
            rules={{ required: 'First name is required' }}
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  placeholder="John"
                  value={value}
                  onChangeText={onChange}
                />
                {errors.firstName && (
                  <Text style={styles.errorText}>{errors.firstName.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="lastName"
            rules={{ required: 'Last name is required' }}
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  placeholder="Doe"
                  value={value}
                  onChangeText={onChange}
                />
                {errors.lastName && (
                  <Text style={styles.errorText}>{errors.lastName.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="legalName"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Legal Name (if different)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Legal name"
                  value={value}
                  onChangeText={onChange}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date of Birth *</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateText}>
                    {formatDate(value, 'MMMM dd, yyyy')}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={value}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, date) => {
                      setShowDatePicker(false);
                      if (date) onChange(date);
                    }}
                  />
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="gender"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Gender *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={value}
                    onValueChange={onChange}
                    style={styles.picker}
                  >
                    <Picker.Item label="Male" value="male" />
                    <Picker.Item label="Female" value="female" />
                    <Picker.Item label="Other" value="other" />
                  </Picker>
                </View>
              </View>
            )}
          />
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <Controller
            control={control}
            name="phone"
            rules={{
              required: 'Phone number is required',
              validate: (value) => {
                const result = validatePhone(value);
                return result.isValid || result.errors[0];
              }
            }}
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder="(555) 123-4567"
                  value={formatPhoneNumber(value)}
                  onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="email"
            rules={{
              validate: (value) => {
                if (!value) return true;
                const result = validateEmail(value);
                return result.isValid || result.errors[0];
              }
            }}
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="john.doe@example.com"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email.message}</Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <Controller
            control={control}
            name="address.street"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Street Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123 Main St"
                  value={value}
                  onChangeText={onChange}
                />
              </View>
            )}
          />

          <View style={styles.row}>
            <Controller
              control={control}
              name="address.city"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.inputContainer, styles.flex1]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="New York"
                    value={value}
                    onChangeText={onChange}
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="address.state"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.inputContainer, styles.stateInput]}>
                  <Text style={styles.label}>State</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="NY"
                    value={value}
                    onChangeText={onChange}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="address.zip"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.inputContainer, styles.zipInput]}>
                  <Text style={styles.label}>ZIP</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10001"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              )}
            />
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          
          <Controller
            control={control}
            name="emergencyContact.name"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Contact Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jane Doe"
                  value={value}
                  onChangeText={onChange}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="emergencyContact.phone"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(555) 987-6543"
                  value={formatPhoneNumber(value)}
                  onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="emergencyContact.relationship"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Relationship</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Spouse, Parent, etc."
                  value={value}
                  onChangeText={onChange}
                />
              </View>
            )}
          />
        </View>

        {/* Insurance */}
        <View style={styles.section}>
          <View style={styles.switchContainer}>
            <Text style={styles.sectionTitle}>Has Insurance</Text>
            <Controller
              control={control}
              name="hasInsurance"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ 
                    false: colors.gray[300], 
                    true: colors.primary[500] 
                  }}
                  thumbColor={colors.background.primary}
                />
              )}
            />
          </View>
          
          {hasInsurance && (
            <TouchableOpacity
              style={styles.insuranceButton}
              onPress={() => {
                // Navigate to insurance form
                Alert.alert('Info', 'Navigate to insurance form');
              }}
            >
              <Text style={styles.insuranceButtonText}>
                Add Insurance Information
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {onCancel && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.submitButton,
              loading && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit(onFormSubmit)}
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner size="small" color={colors.text.inverse} />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditMode ? 'Update Patient' : 'Create Patient'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
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
  inputError: {
    borderColor: colors.status.error,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.status.error,
    marginTop: spacing.xs,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: spacing.borderRadius.md,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  stateInput: {
    width: 80,
  },
  zipInput: {
    width: 100,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insuranceButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
  },
  insuranceButtonText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    ...spacing.shadow.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  submitButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
