export const colors = {
  // Primary colors - Medical industry standard blue
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93BBFD',
    400: '#60A5FA',
    500: '#3B82F6', // Main primary color
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  
  // Secondary colors - For emphasis
  secondary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },
  
  // Severity colors for medical alerts
  severity: {
    low: '#10B981',      // Green
    medium: '#F59E0B',   // Yellow/Amber
    high: '#EF4444',     // Red
    urgent: '#DC2626',   // Dark Red
    critical: '#991B1B', // Darker Red
  },
  
  // Neutral colors (Grays)
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },
  
  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    card: '#FFFFFF',
    modal: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Text colors
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    link: '#3B82F6',
    disabled: '#D1D5DB',
  },
  
  // Status colors
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  
  // Border colors
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
    focus: '#3B82F6',
  },
  
  // Shadow colors
  shadow: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(0, 0, 0, 0.2)',
  },
  
  // Special medical colors
  medical: {
    vitals: '#059669',      // Vital signs
    medication: '#7C3AED',  // Medications
    lab: '#DC2626',         // Lab results
    imaging: '#2563EB',     // Imaging/X-rays
    appointment: '#F59E0B', // Appointments
  },
};

// Dark mode colors (optional)
export const darkColors = {
  ...colors,
  background: {
    primary: '#111827',
    secondary: '#1F2937',
    tertiary: '#374151',
    card: '#1F2937',
    modal: 'rgba(0, 0, 0, 0.8)',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    tertiary: '#9CA3AF',
    inverse: '#111827',
    link: '#60A5FA',
    disabled: '#4B5563',
  },
  border: {
    light: '#374151',
    medium: '#4B5563',
    dark: '#6B7280',
    focus: '#60A5FA',
  },
};
