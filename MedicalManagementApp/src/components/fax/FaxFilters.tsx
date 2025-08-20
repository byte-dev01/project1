import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { SEVERITY_LEVELS } from '../../../utils/constants';

interface FaxFiltersProps {
  selectedSeverity: string | null;
  onSeverityChange: (severity: string | null) => void;
  selectedStatus?: string | null;
  onStatusChange?: (status: string | null) => void;
  showStatusFilter?: boolean;
}

export const FaxFilters: React.FC<FaxFiltersProps> = ({
  selectedSeverity,
  onSeverityChange,
  selectedStatus,
  onStatusChange,
  showStatusFilter = false,
}) => {
  const severityOptions = [
    { value: null, label: 'All', color: colors.gray[500] },
    ...Object.entries(SEVERITY_LEVELS).map(([key, level]) => ({
      value: level.value,
      label: level.value,
      color: level.color,
    })),
  ];

  const statusOptions = [
    { value: null, label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'processed', label: 'Processed' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Severity Level</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {severityOptions.map((option) => (
            <TouchableOpacity
              key={option.value || 'all'}
              style={[
                styles.filterChip,
                selectedSeverity === option.value && styles.filterChipSelected,
                selectedSeverity === option.value && { backgroundColor: option.color },
              ]}
              onPress={() => onSeverityChange(option.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeverity === option.value && styles.filterChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {showStatusFilter && onStatusChange && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value || 'all-status'}
                style={[
                  styles.filterChip,
                  selectedStatus === option.value && styles.filterChipSelected,
                ]}
                onPress={() => onStatusChange(option.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatus === option.value && styles.filterChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterChipSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextSelected: {
    color: colors.text.inverse,
  },
});
