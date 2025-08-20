export const API_CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'https://api.healthbridge.com',
  TIMEOUT: parseInt(process.env.API_TIMEOUT || '30000'),
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const AUTH_CONFIG = {
  TOKEN_KEY: 'auth_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  USER_KEY: 'user_data',
  CREDENTIALS_KEY: 'user_credentials',
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3'),
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15') * 60 * 1000,
};

export const STORAGE_KEYS = {
  THEME: 'app_theme',
  LANGUAGE: 'app_language',
  NOTIFICATIONS: 'notification_settings',
  OFFLINE_QUEUE: 'offline_sync_queue',
  CACHED_DATA: 'cached_data',
};

export const DATE_FORMATS = {
  SHORT: 'MM/dd/yyyy',
  LONG: 'MMMM dd, yyyy',
  TIME: 'hh:mm a',
  DATETIME: 'MM/dd/yyyy hh:mm a',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
};

export const SEVERITY_LEVELS = {
  LOW: { value: '轻度', color: '#10B981', priority: 1 },
  MEDIUM: { value: '中度', color: '#F59E0B', priority: 2 },
  HIGH: { value: '重度', color: '#EF4444', priority: 3 },
  URGENT: { value: '紧急', color: '#DC2626', priority: 4 },
};

export const MESSAGE_TYPES = {
  GENERAL: { value: 'general', label: 'General Question', icon: 'message-circle' },
  MEDICATION: { value: 'medication', label: 'Medication Question', icon: 'pill' },
  APPOINTMENT: { value: 'appointment', label: 'Appointment Request', icon: 'calendar' },
  RESULTS: { value: 'results', label: 'Test Results Question', icon: 'clipboard' },
  REFILL: { value: 'refill', label: 'Prescription Refill', icon: 'refresh-cw' },
};

export const RECORD_TYPES = {
  OCR_EXTRACTED: { value: 'OCR_EXTRACTED', label: 'OCR Extracted', icon: 'scan' },
  MANUAL: { value: 'MANUAL', label: 'Manual Entry', icon: 'edit' },
  FAX: { value: 'FAX', label: 'Fax Document', icon: 'printer' },
  LAB: { value: 'LAB', label: 'Lab Results', icon: 'activity' },
  IMAGING: { value: 'IMAGING', label: 'Imaging', icon: 'image' },
  PRESCRIPTION: { value: 'PRESCRIPTION', label: 'Prescription', icon: 'file-text' },
};

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  PHONE_REGEX: /^\d{3}-\d{3}-\d{4}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SSN_REGEX: /^\d{3}-\d{2}-\d{4}$/,
  ZIP_REGEX: /^\d{5}(-\d{4})?$/,
};
