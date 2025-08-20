import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaWrapper } from '../components/common/SafeAreaWrapper';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PatientDetailScreenRouteProp } from '../../types/navigation.types';
import { patientsAPI } from '../api/patients';
import { Patient, MedicalRecord, Medication } from '../../types/models.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { 
  formatDate, 
  calculateAge, 
  formatPhoneNumber,
  makePhoneCall,
  sendEmail,
  getInitials,
} from '../../utils/helpers';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

type TabType = 'overview' | 'records' | 'medications' | 'insurance';

export const PatientDetailScreen: React.FC = () => {
  const route = useRoute<PatientDetailScreenRouteProp>();
  const navigation = useNavigation();
  const { patientId, tab: initialTab } = route.params;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'overview');

  const tabs = ['Overview', 'Records', 'Medications', 'Insurance'];
  const tabValues: TabType[] = ['overview', 'records', 'medications', 'insurance'];

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      const [patientData, patientRecords] = await Promise.all([
        patientsAPI.getPatientById(patientId),
        patientsAPI.getPatientRecords(patientId),
      ]);
      
      setPatient(patientData);
      setRecords(patientRecords);
    } catch (error) {
      Alert.alert('Error', 'Failed to load patient data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('PatientEdit' as any, { patientId });
  };

  const handleAddRecord = () => {
    Alert.alert('Add Record', 'Navigate to add record screen');
  };

  const handleAddMedication = () => {
    Alert.alert('Add Medication', 'Navigate to add medication screen');
  };

  const handleUpdateInsurance = () => {
    navigation.navigate('InsuranceForm' as any, { patientId });
  };

  const handleCallPatient = () => {
    if (patient?.contact?.phone) {
      makePhoneCall(patient.contact.phone);
    }
  };

  const handleEmailPatient = () => {
    if (patient?.contact?.email) {
      sendEmail(patient.contact.email, 'HealthBridge Patient Communication');
    }
  };

  const handleEmergencyCall = () => {
    if (patient?.emergencyContact?.phone) {
      Alert.alert(
        'Call Emergency Contact',
        'Are you sure you want to call the emergency contact?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Call', 
            onPress: () => makePhoneCall(patient.emergencyContact!.phone) 
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <LoadingSpinner fullScreen text="Loading patient data..." />
      </SafeAreaWrapper>
    );
  }

  if (!patient) {
    return (
      <SafeAreaWrapper>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Patient not found</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  const age = calculateAge(patient.dateOfBirth);

  const renderOverviewTab = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Patient Header */}
      <View style={styles.patientHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {getInitials(patient.firstName, patient.lastName)}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.patientName}>
            {patient.firstName} {patient.lastName}
          </Text>
          {patient.legalName && (
            <Text style={styles.legalName}>Legal: {patient.legalName}</Text>
          )}
          <View style={styles.basicInfo}>
            <Text style={styles.infoText}>
              {age} years • {patient.gender || 'Unknown'}
            </Text>
            <Text style={styles.infoText}>
              DOB: {formatDate(patient.dateOfBirth, 'MMM dd, yyyy')}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleCallPatient}
          disabled={!patient.contact?.phone}
        >
          <Text style={styles.actionIcon}>📞</Text>
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleEmailPatient}
          disabled={!patient.contact?.email}
        >
          <Text style={styles.actionIcon}>✉️</Text>
          <Text style={styles.actionText}>Email</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleEdit}
        >
          <Text style={styles.actionIcon}>✏️</Text>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {}}
        >
          <Text style={styles.actionIcon}>📄</Text>
          <Text style={styles.actionText}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <TouchableOpacity onPress={handleCallPatient}>
            <Text style={[styles.infoValue, styles.link]}>
              {formatPhoneNumber(patient.contact?.phone || '')}
            </Text>
          </TouchableOpacity>
        </View>
        
        {patient.contact?.email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <TouchableOpacity onPress={handleEmailPatient}>
              <Text style={[styles.infoValue, styles.link]}>
                {patient.contact.email}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {patient.contact?.address && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>
              {patient.contact.address.street}
              {'\n'}
              {patient.contact.address.city}, {patient.contact.address.state} {patient.contact.address.zip}
            </Text>
          </View>
        )}
      </View>

      {/* Emergency Contact */}
      {patient.emergencyContact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <TouchableOpacity onPress={handleEmergencyCall}>
              <Text style={[styles.infoValue, styles.link]}>
                {formatPhoneNumber(patient.emergencyContact.phone)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Medical Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medical Information</Text>
        
        {patient.allergies && patient.allergies.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Allergies:</Text>
            <View style={styles.tagContainer}>
              {patient.allergies.map((allergy, index) => (
                <View key={index} style={[styles.tag, styles.allergyTag]}>
                  <Text style={styles.tagText}>{allergy}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {patient.conditions && patient.conditions.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Conditions:</Text>
            <View style={styles.tagContainer}>
              {patient.conditions.map((condition, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{condition}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderRecordsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={handleAddRecord}
      >
        <Text style={styles.addButtonText}>+ Add Record</Text>
      </TouchableOpacity>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No medical records</Text>
          </View>
        ) : (
          records.map((record) => (
            <TouchableOpacity 
              key={record.id} 
              style={styles.recordCard}
              onPress={() => {
                // Navigate to record detail
              }}
            >
              <View style={styles.recordHeader}>
                <Text style={styles.recordType}>{record.recordType}</Text>
                <Text style={styles.recordDate}>
                  {formatDate(record.createdAt, 'MMM dd, yyyy')}
                </Text>
              </View>
              {record.chiefComplaint && (
                <Text style={styles.recordComplaint}>{record.chiefComplaint}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderMedicationsTab = () => {
    const activeMeds = patient.medications?.filter(m => m.active) || [];
    const inactiveMeds = patient.medications?.filter(m => !m.active) || [];

    return (
      <View style={styles.tabContent}>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddMedication}
        >
          <Text style={styles.addButtonText}>+ Add Medication</Text>
        </TouchableOpacity>
        
        <ScrollView showsVerticalScrollIndicator={false}>
          {activeMeds.length === 0 && inactiveMeds.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyText}>No medications</Text>
            </View>
          ) : (
            <>
              {activeMeds.length > 0 && (
                <View style={styles.medicationSection}>
                  <Text style={styles.medicationSectionTitle}>Active Medications</Text>
                  {activeMeds.map((med, index) => (
                    <View key={index} style={styles.medicationCard}>
                      <View style={styles.medicationHeader}>
                        <Text style={styles.medicationName}>{med.name}</Text>
                        <View style={[styles.statusBadge, styles.activeBadge]}>
                          <Text style={styles.statusBadgeText}>Active</Text>
                        </View>
                      </View>
                      <Text style={styles.medicationDosage}>
                        {med.dosage} • {med.frequency}
                      </Text>
                      {med.prescribedBy && (
                        <Text style={styles.medicationPrescriber}>
                          Prescribed by: {med.prescribedBy}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
              
              {inactiveMeds.length > 0 && (
                <View style={styles.medicationSection}>
                  <Text style={styles.medicationSectionTitle}>Inactive Medications</Text>
                  {inactiveMeds.map((med, index) => (
                    <View key={index} style={[styles.medicationCard, styles.inactiveCard]}>
                      <View style={styles.medicationHeader}>
                        <Text style={styles.medicationName}>{med.name}</Text>
                        <View style={[styles.statusBadge, styles.inactiveBadge]}>
                          <Text style={styles.statusBadgeText}>Inactive</Text>
                        </View>
                      </View>
                      <Text style={styles.medicationDosage}>
                        {med.dosage} • {med.frequency}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderInsuranceTab = () => (
    <View style={styles.tabContent}>
      {patient.insurance ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.insuranceCard}>
            <View style={styles.insuranceHeader}>
              <Text style={styles.insuranceCompany}>
                {patient.insurance.companyName}
              </Text>
              <TouchableOpacity onPress={handleUpdateInsurance}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.insuranceDetails}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Policy Number:</Text>
                <Text style={styles.infoValue}>{patient.insurance.policyNumber}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Insurance ID:</Text>
                <Text style={styles.infoValue}>{patient.insurance.insuranceNumber}</Text>
              </View>
              
              {patient.insurance.groupNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Group Number:</Text>
                  <Text style={styles.infoValue}>{patient.insurance.groupNumber}</Text>
                </View>
              )}
              
              {patient.insurance.copay !== undefined && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Copay:</Text>
                  <Text style={styles.infoValue}>${patient.insurance.copay}</Text>
                </View>
              )}
              
              {patient.insurance.deductible !== undefined && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Deductible:</Text>
                  <Text style={styles.infoValue}>${patient.insurance.deductible}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏥</Text>
          <Text style={styles.emptyText}>No insurance information</Text>
          <TouchableOpacity 
            style={styles.addInsuranceButton}
            onPress={handleUpdateInsurance}
          >
            <Text style={styles.addInsuranceButtonText}>Add Insurance</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'records':
        return renderRecordsTab();
      case 'medications':
        return renderMedicationsTab();
      case 'insurance':
        return renderInsuranceTab();
      default:
        return null;
    }
  };

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Patient Details</Text>
          <TouchableOpacity onPress={handleEdit}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <SegmentedControl
            values={tabs}
            selectedIndex={tabValues.indexOf(activeTab)}
            onChange={(event) => {
              setActiveTab(tabValues[event.nativeEvent.selectedSegmentIndex]);
            }}
            style={styles.segmentControl}
          />
        </View>

        {renderTabContent()}
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backIcon: {
    fontSize: 32,
    color: colors.primary[600],
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  editText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  segmentControl: {
    backgroundColor: colors.background.secondary,
  },
  tabContent: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
  },
  patientHeader: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    marginBottom: spacing.xs,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  legalName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  basicInfo: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    marginBottom: spacing.xs,
  },
  actionButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  section: {
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    width: 100,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  link: {
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  tagContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.full,
  },
  allergyTag: {
    backgroundColor: colors.status.error + '20',
  },
  tagText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  addButton: {
    backgroundColor: colors.primary[500],
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  recordCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    ...spacing.shadow.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  recordType: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  recordDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  recordComplaint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  medicationSection: {
    marginBottom: spacing.lg,
  },
  medicationSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
  },
  medicationCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    ...spacing.shadow.sm,
  },
  inactiveCard: {
    opacity: 0.7,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  medicationName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  medicationDosage: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  medicationPrescriber: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.full,
  },
  activeBadge: {
    backgroundColor: colors.status.success + '20',
  },
  inactiveBadge: {
    backgroundColor: colors.gray[200],
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  insuranceCard: {
    backgroundColor: colors.background.primary,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: spacing.borderRadius.md,
    ...spacing.shadow.sm,
  },
  insuranceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  insuranceCompany: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  editLink: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  insuranceDetails: {
    gap: spacing.sm,
  },
  addInsuranceButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
  },
  addInsuranceButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
