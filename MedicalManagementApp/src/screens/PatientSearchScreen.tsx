import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaWrapper } from '../components/common/SafeAreaWrapper';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PatientDetailScreenNavigationProp } from '../../types/navigation.types';
import { patientsAPI } from '../api/patients';
import { Patient } from '../../types/models.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { formatDate, getInitials, formatPhoneNumber } from '../../utils/helpers';
import { debounce } from 'lodash';

interface RouteParams {
  mode?: 'select' | 'view';
  onSelect?: (patientId: string) => void;
}

export const PatientSearchScreen: React.FC = () => {
  const navigation = useNavigation<PatientDetailScreenNavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const isSelectMode = params?.mode === 'select';

  useEffect(() => {
    loadRecentPatients();
  }, []);

  const loadRecentPatients = async () => {
    try {
      const response = await patientsAPI.getPatients(1, 10);
      setRecentPatients(response.data);
    } catch (error) {
      console.error('Failed to load recent patients:', error);
    } finally {
      setLoadingRecent(false);
    }
  };

  // Debounced search function
  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setPatients([]);
        return;
      }

      setLoading(true);
      try {
        const results = await patientsAPI.searchPatients(query);
        setPatients(results);
      } catch (error) {
        console.error('Search error:', error);
        Alert.alert('Error', 'Failed to search patients');
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    performSearch(text);
  };

  const handlePatientSelect = (patient: Patient) => {
    if (isSelectMode && params.onSelect) {
      params.onSelect(patient.id);
      navigation.goBack();
    } else {
      navigation.navigate('PatientDetail', { patientId: patient.id });
    }
  };

  const handleNewPatient = () => {
    navigation.navigate('NewPatient' as any);
  };

  const renderPatientItem = ({ item }: { item: Patient }) => {
    const age = formatDate(item.dateOfBirth, 'yyyy') 
      ? new Date().getFullYear() - parseInt(formatDate(item.dateOfBirth, 'yyyy'))
      : null;

    return (
      <TouchableOpacity
        style={styles.patientCard}
        onPress={() => handlePatientSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.patientAvatar}>
          <Text style={styles.avatarText}>
            {getInitials(item.firstName, item.lastName)}
          </Text>
        </View>
        
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>
            {item.firstName} {item.lastName}
            {item.legalName && (
              <Text style={styles.legalName}> ({item.legalName})</Text>
            )}
          </Text>
          
          <View style={styles.patientDetails}>
            <Text style={styles.detailText}>
              DOB: {formatDate(item.dateOfBirth, 'MM/dd/yyyy')}
              {age && ` (${age} yrs)`}
            </Text>
            <Text style={styles.detailText}>
              {item.gender ? item.gender.charAt(0).toUpperCase() + item.gender.slice(1) : 'Unknown'}
            </Text>
          </View>
          
          <View style={styles.contactInfo}>
            {item.contact?.phone && (
              <Text style={styles.contactText}>
                📱 {formatPhoneNumber(item.contact.phone)}
              </Text>
            )}
            {item.insurance && (
              <Text style={styles.contactText}>
                🏥 {item.insurance.companyName}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {searchQuery.length >= 2 ? (
        <>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No patients found</Text>
          <Text style={styles.emptyMessage}>
            Try adjusting your search terms
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>Search for patients</Text>
          <Text style={styles.emptyMessage}>
            Enter at least 2 characters to search
          </Text>
        </>
      )}
    </View>
  );

  const displayPatients = searchQuery.length >= 2 ? patients : recentPatients;
  const sectionTitle = searchQuery.length >= 2 ? 'Search Results' : 'Recent Patients';

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {isSelectMode ? 'Select Patient' : 'Patient Search'}
          </Text>
          {!isSelectMode && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleNewPatient}
            >
              <Text style={styles.addButtonText}>+ New</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, DOB, or phone..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  setPatients([]);
                  Keyboard.dismiss();
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading || loadingRecent ? (
          <LoadingSpinner text="Loading patients..." />
        ) : (
          <FlatList
            data={displayPatients}
            keyExtractor={(item) => item.id}
            renderItem={renderPatientItem}
            ListHeaderComponent={() => 
              displayPatients.length > 0 ? renderSectionHeader(sectionTitle) : null
            }
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
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
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  addButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
  },
  addButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearIcon: {
    fontSize: 20,
    color: colors.text.tertiary,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    ...spacing.shadow.sm,
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  legalName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  patientDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  contactInfo: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  contactText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  chevronText: {
    fontSize: 24,
    color: colors.text.tertiary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});

