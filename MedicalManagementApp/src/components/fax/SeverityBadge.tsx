import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { getSeverityColor } from '../../../utils/helpers';

interface SeverityBadgeProps {
  severity: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'medium',
  style,
}) => {
  const backgroundColor = getSeverityColor(severity);
  const isUrgent = severity === '紧急' || severity.toLowerCase() === 'urgent';

  return (
    <View 
      style={[
        styles.container,
        styles[size],
        { backgroundColor },
        isUrgent && styles.urgent,
        style,
      ]}
    >
      <Text style={[styles.text, styles[`${size}Text`]]}>
        {severity}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgent: {
    // Add pulsing animation for urgent items
  },
  small: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  large: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
  },
  smallText: {
    fontSize: typography.fontSize.xs,
  },
  mediumText: {
    fontSize: typography.fontSize.sm,
  },
  largeText: {
    fontSize: typography.fontSize.base,
  },
});
