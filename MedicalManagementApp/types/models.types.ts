export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  roles: UserRole[];
  clinicId: string;
  clinicName: string;
  permissions: string[];
  lastLogin?: Date;
}

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'staff' | 'patient';

export interface Clinic {
  _id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone: string;
  email: string;
  active: boolean;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  legalName?: string;
  dateOfBirth: string;
  gender?: 'male' | 'female' | 'other';
  insurance?: Insurance;
  records: MedicalRecord[];
  contact: ContactInfo;
  emergencyContact?: ContactInfo;
  allergies?: string[];
  medications?: Medication[];
  conditions?: string[];
}

export interface ContactInfo {
  phone: string;
  email?: string;
  address?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface Insurance {
  companyName: string;
  insuranceNumber: string;
  policyNumber: string;
  groupNumber?: string;
  copay?: number;
  deductible?: number;
  effectiveDate?: string;
  expirationDate?: string;
  subscriberName?: string;
  subscriberRelation?: 'self' | 'spouse' | 'child' | 'other';
}

export interface FaxMessage {
  _id: string;
  fileName: string;
  processedAt: Date;
  severityLevel: '轻度' | '中度' | '重度' | '紧急';
  severityScore: number;
  severityReason: string;
  summary: string;
  transcription: string;
  status: 'pending' | 'processed' | 'reviewed' | 'archived';
  assignedTo?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
  tags?: string[];
  patientId?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  recordType: 'OCR_EXTRACTED' | 'MANUAL' | 'FAX' | 'LAB' | 'IMAGING' | 'PRESCRIPTION';
  chiefComplaint?: string;
  medicalHistory?: string;
  medications?: Medication[];
  presentIllness?: string;
  historyIllness?: string;
  physicianNotes?: string;
  vitalSigns?: VitalSigns;
  labResults?: LabResult[];
  attachments?: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface VitalSigns {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export interface LabResult {
  testName: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  status: 'normal' | 'abnormal' | 'critical';
  date: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  prescribedBy?: string;
  pharmacy?: string;
  refillsRemaining?: number;
  instructions?: string;
  active: boolean;
}

export interface Message {
  id: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'archived';
  sender: string;
  senderRole: string;
  senderName: string;
  recipient: string;
  recipientName: string;
  subject: string;
  content: string;
  timestamp: Date;
  unread: boolean;
  urgent: boolean;
  hasAttachment: boolean;
  attachments?: Attachment[];
  thread?: MessageThread;
  messageType: 'general' | 'medication' | 'appointment' | 'results' | 'refill';
}

export interface MessageThread {
  id: string;
  messages: Message[];
  participants: string[];
  lastMessageAt: Date;
  unreadCount: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url?: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  date: Date;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'lab' | 'imaging';
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  reason: string;
  notes?: string;
  location?: string;
  telehealth?: boolean;
  reminderSent?: boolean;
}
