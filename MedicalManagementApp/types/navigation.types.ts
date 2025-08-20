// src/types/navigation.types.ts
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  ClinicSelection: undefined;
  ForgotPassword: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Dashboard: undefined;
  Fax: undefined;
  Patients: undefined;
  Messages: undefined;
  More: undefined;
};

// Fax Stack
export type FaxStackParamList = {
  FaxList: { severityFilter?: string };
  FaxDetail: { faxId: string };
  FaxSearch: undefined;
};

// Patient Stack
export type PatientStackParamList = {
  PatientSearch: undefined;
  PatientDetail: { patientId: string; tab?: 'overview' | 'records' | 'medications' | 'results' };
  PatientEdit: { patientId: string };
  NewPatient: undefined;
  InsuranceForm: { patientId?: string };
};

// Message Stack
export type MessageStackParamList = {
  MessageList: { folder?: string };
  MessageDetail: { messageId: string };
  ComposeMessage: { recipientId?: string; subject?: string };
};

// Root Stack
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Modal: { screen: string; params?: any };
};

// Navigation Props Types
export type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;
export type FaxListScreenNavigationProp = StackNavigationProp<FaxStackParamList, 'FaxList'>;
export type FaxDetailScreenRouteProp = RouteProp<FaxStackParamList, 'FaxDetail'>;
export type PatientDetailScreenNavigationProp = StackNavigationProp<PatientStackParamList, 'PatientDetail'>;
export type PatientDetailScreenRouteProp = RouteProp<PatientStackParamList, 'PatientDetail'>;

// Screen Props Types
export interface ScreenProps<T extends keyof RootStackParamList> {
  navigation: StackNavigationProp<RootStackParamList, T>;
  route: RouteProp<RootStackParamList, T>;
}
