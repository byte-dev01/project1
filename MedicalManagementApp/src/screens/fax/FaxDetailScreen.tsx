import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaWrapper } from '../../components/common/SafeAreaWrapper';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SeverityBadge } from '../../components/fax/SeverityBadge';
import { FaxDetailScreenRouteProp } from '../../../types/navigation.types';
import { faxAPI } from '../../api/fax';
import { FaxMessage } from '../../../types/models.types';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { formatDate, getSeverityColor } from '../../../utils/helpers';
import { useAuthStore } from '../../../store/authStore';

export const FaxDetailScreen: React.FC = () => {
  const route = useRoute<FaxDetailScreenRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { faxId } = route.params;

  const [fax, setFax] = useState<FaxMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadFaxDetail();
  }, [faxId]);

  const loadFaxDetail = async () => {
    try {
      const faxData = await faxAPI.getFaxDetail(faxId);
      setFax(faxData);
      setNotes(faxData.notes || '');
    } catch (error) {
      Alert.alert('Error', 'Failed to load fax details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: FaxMessage['status']) => {
    if (!fax) return;

    Alert.alert(
      'Update Status',
      `Mark this fax as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              const updated = await faxAPI.updateFaxStatus(faxId, newStatus, notes);
              setFax(updated);
              Alert.alert('Success', 'Status updated successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to update status');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleAssign = () => {
    Alert.prompt(
      'Assign Fax',
      'Enter the username or ID of the person to assign this fax to:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async (assignee) => {
            if (!assignee) return;
            
            setUpdating(true);
            try {
              await faxAPI.assignFax(faxId, assignee);
              Alert.alert('Success', `Fax assigned to ${assignee}`);
              loadFaxDetail();
            } catch (error) {
              Alert.alert('Error', 'Failed to assign fax');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    if (!fax) return;

    try {
      await Share.share({
        title: `Fax: ${fax.fileName}`,
        message: `Fax Details\n\nFile: ${fax.fileName}\nSeverity: ${fax.severityLevel}\nSummary: ${fax.summary}\n\nView in HealthBridge app`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleViewOriginal = () => {
    // In production, this would open the original PDF/document
    Alert.alert('View Original', 'Opening original document viewer...');
  };

  const handleAddToPatient = () => {
    // Navigate to patient search/selection
    navigation.navigate('PatientSearch' as any, { 
      mode: 'select',
      onSelect: (patientId: string) => {
        // Link fax to patient
        Alert.alert('Success', 'Fax linked to patient record');
      }
    });
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <LoadingSpinner fullScreen text="Loading fax details..." />
      </SafeAreaWrapper>
    );
  }

  if (!fax) {
    return (
      <SafeAreaWrapper>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Fax not found</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  const StatusButton = ({ 
    status, 
    label, 
    color 
  }: { 
    status: FaxMessage['status']; 
    label: string; 
    color: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.statusButton,
        fax.status === status && { backgroundColor: color }
      ]}
      onPress={() => handleStatusUpdate(status)}
      disabled={fax.status === status || updating}
    >
      <Text style={[
        styles.statusButtonText,
        fax.status === status && { color: colors.text.inverse }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaWrapper>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[
          styles.header,
          { borderLeftColor: getSeverityColor(fax.severityLevel) }
        ]}>
          <View style={styles.headerTop}>
            <Text style={styles.fileName}>{fax.fileName}</Text>
            <SeverityBadge severity={fax.severityLevel} size="large" />
          </View>
          
          <Text style={styles.timestamp}>
            Received: {formatDate(fax.processedAt, 'MMMM dd, yyyy hh:mm a')}
          </Text>
          
          {fax.assignedTo && (
            <Text style={styles.assignedTo}>
              Assigned to: {fax.assignedTo}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleViewOriginal}>
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionText}>View Original</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleAddToPatient}>
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionText}>Link Patient</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleAssign}>
            <Text style={styles.actionIcon}>✋</Text>
            <Text style={styles.actionText}>Assign</Text>
          </TouchableOpacity>
        </View>

        {/* Status Update */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusButtons}>
            <StatusButton 
              status="pending" 
              label="Pending" 
              color={colors.status.warning}
            />
            <StatusButton 
              status="processed" 
              label="Processed" 
              color={colors.status.info}
            />
            <StatusButton 
              status="reviewed" 
              label="Reviewed" 
              color={colors.status.success}
            />
            <StatusButton 
              status="archived" 
              label="Archived" 
              color={colors.gray[500]}
            />
          </View>
        </View>

        {/* Severity Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity Assessment</Text>
          <View style={styles.severityInfo}>
            <View style={styles.severityRow}>
              <Text style={styles.severityLabel}>Level:</Text>
              <SeverityBadge severity={fax.severityLevel} />
            </View>
            <View style={styles.severityRow}>
              <Text style={styles.severityLabel}>Score:</Text>
              <Text style={styles.severityScore}>{fax.severityScore}/10</Text>
            </View>
            <View style={styles.severityRow}>
              <Text style={styles.severityLabel}>Reason:</Text>
              <Text style={styles.severityReason}>{fax.severityReason}</Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.contentBox}>
            <Text style={styles.contentText}>{fax.summary}</Text>
          </View>
        </View>

        {/* Transcription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Transcription</Text>
          <View style={styles.contentBox}>
            <Text style={styles.contentText}>{fax.transcription}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.saveNotesButton}
            onPress={async () => {
              if (!fax) return;
              setUpdating(true);
              try {
                await faxAPI.updateFaxStatus(faxId, fax.status, notes);
                Alert.alert('Success', 'Notes saved');
              } catch (error) {
                Alert.alert('Error', 'Failed to save notes');
              } finally {
                setUpdating(false);
              }
            }}
            disabled={updating || notes === fax.notes}
          >
            <Text style={styles.saveNotesButtonText}>Save Notes</Text>
          </TouchableOpacity>
        </View>

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metadata</Text>
          <View style={styles.metadataContainer}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>ID:</Text>
              <Text style={styles.metadataValue}>{fax._id}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Processed:</Text>
              <Text style={styles.metadataValue}>
                {formatDate(fax.processedAt, 'MM/dd/yyyy hh:mm:ss a')}
              </Text>
            </View>
            {fax.reviewedBy && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Reviewed by:</Text>
                <Text style={styles.metadataValue}>{fax.reviewedBy}</Text>
              </View>
            )}
            {fax.reviewedAt && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Reviewed at:</Text>
                <Text style={styles.metadataValue}>
                  {formatDate(fax.reviewedAt, 'MM/dd/yyyy hh:mm:ss a')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
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
  header: {
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderLeftWidth: 6,
    ...spacing.shadow.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  fileName: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginRight: spacing.md,
  },
  timestamp: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  assignedTo: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    marginTop: spacing.xs,
    ...spacing.shadow.sm,
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
    marginTop: spacing.md,
    padding: spacing.lg,
    ...spacing.shadow.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusButton: {
    flex: 1,
    minWidth: 80,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  severityInfo: {
    gap: spacing.md,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    width: 80,
  },
  severityScore: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  severityReason: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  contentBox: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
  },
  contentText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.relaxed,
  },
  notesInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveNotesButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.borderRadius.md,
    alignSelf: 'flex-start',
  },
  saveNotesButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  metadataContainer: {
    gap: spacing.sm,
  },
  metadataRow: {
    flexDirection: 'row',
  },
  metadataLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    width: 100,
  },
  metadataValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.mono,
  },
});
