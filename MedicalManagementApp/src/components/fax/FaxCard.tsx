import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { FaxMessage } from '../../../types/models.types';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { formatDate, truncateText, getSeverityColor } from '../../../utils/helpers';
import { SeverityBadge } from './SeverityBadge';

interface FaxCardProps {
  fax: FaxMessage;
  onPress: () => void;
  selected?: boolean;
}

export const FaxCard: React.FC<FaxCardProps> = ({ fax, onPress, selected }) => {
  const isNew = fax.status === 'pending';
  const borderColor = getSeverityColor(fax.severityLevel);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderLeftColor: borderColor },
        selected && styles.selected,
        isNew && styles.new,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.fileName}>{fax.fileName}</Text>
          <Text style={styles.timestamp}>
            {formatDate(fax.processedAt, 'MMM dd, yyyy hh:mm a')}
          </Text>
        </View>
        <SeverityBadge severity={fax.severityLevel} />
      </View>

      <View style={styles.content}>
        <Text style={styles.summary} numberOfLines={2}>
          {fax.summary || truncateText(fax.transcription, 100)}
        </Text>
        
        {fax.severityReason && (
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonLabel}>Reason: </Text>
            <Text style={styles.reasonText} numberOfLines={1}>
              {fax.severityReason}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(fax.status) }]} />
          <Text style={styles.statusText}>{capitalizeStatus(fax.status)}</Text>
        </View>
        
        {fax.assignedTo && (
          <Text style={styles.assignedText}>
            Assigned to: {fax.assignedTo}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return colors.status.warning;
    case 'processed':
      return colors.status.info;
    case 'reviewed':
      return colors.status.success;
    case 'archived':
      return colors.gray[400];
    default:
      return colors.gray[400];
  }
};

const capitalizeStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.borderRadius.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...spacing.shadow.md,
  },
  selected: {
    backgroundColor: colors.primary[50],
  },
  new: {
    backgroundColor: colors.secondary[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  fileName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  timestamp: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  content: {
    marginBottom: spacing.sm,
  },
  summary: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed,
  },
  reasonContainer: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  reasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  reasonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  assignedText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
});

