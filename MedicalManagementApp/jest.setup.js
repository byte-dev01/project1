// Jest setup file for React Native testing

// Mock React Native modules
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getSystemVersion: jest.fn(() => '14.0'),
  getUniqueId: jest.fn(() => 'test-device-id'),
  getDeviceId: jest.fn(() => 'test-device'),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((callback) => {
      callback({
        executeSql: jest.fn((sql, params, success, error) => {
          success && success({ rows: { length: 0, item: jest.fn() } });
        }),
      });
    }),
    executeSql: jest.fn(() => Promise.resolve([{ rows: { length: 0 } }])),
    close: jest.fn(),
    on: jest.fn(),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1, 2])),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn((algorithm, data) => 
    Promise.resolve('mocked-hash-' + data.slice(0, 10))
  ),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
}));

// Mock crypto-js
jest.mock('crypto-js', () => ({
  SHA256: jest.fn((data) => ({
    toString: jest.fn(() => 'mocked-sha256-hash'),
  })),
  AES: {
    encrypt: jest.fn((data, key) => ({
      toString: jest.fn(() => 'encrypted-data'),
    })),
    decrypt: jest.fn((data, key) => ({
      toString: jest.fn(() => 'decrypted-data'),
    })),
  },
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
  NavigationContainer: ({ children }) => children,
}));

// Global test utilities
global.mockAuthUser = {
  id: 'test-user-123',
  username: 'testdoctor',
  email: 'test@healthbridge.com',
  name: 'Dr. Test User',
  roles: ['doctor'],
  clinicId: 'clinic-456',
  clinicName: 'Test Clinic',
  permissions: ['read', 'write', 'prescribe'],
};

global.mockPatient = {
  id: 'patient-789',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1980-01-01',
  gender: 'male',
  contact: {
    phone: '555-0123',
    email: 'john.doe@email.com',
  },
  allergies: ['Penicillin'],
  medications: [],
  conditions: ['Hypertension'],
};

// Suppress console warnings in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((message) => {
    if (
      typeof message === 'string' &&
      !message.includes('Warning: ReactTestRenderer')
    ) {
      originalError(message);
    }
  });
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});