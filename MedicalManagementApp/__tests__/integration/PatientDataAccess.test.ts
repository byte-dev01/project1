/**
 * Integration Test: Patient Data Access Flow
 * Tests the complete flow of accessing patient data with proper security and compliance
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useAuthStore } from '@store/authStore';
import { usePatientStore } from '@store/patientStore';
import { SecureStorageService } from '@/services/SecureStorageService';
import { SecureAPIClient } from '@/services/SecureAPIClient';
import { auditTrailService } from '@/core/compliance/AuditTrail';
import { SimpleConsentService } from '@/services/simpleConsentServices';
import NetInfo from '@react-native-community/netinfo';

// Mock all dependencies
jest.mock('@/services/SecureStorageService');
jest.mock('@/services/SecureAPIClient');
jest.mock('@/core/compliance/AuditTrail');
jest.mock('@/services/simpleConsentServices');
jest.mock('@react-native-community/netinfo');

describe('Patient Data Access Integration', () => {
  const mockDoctor = {
    id: 'doctor-123',
    username: 'dr.smith',
    email: 'smith@healthbridge.com',
    name: 'Dr. Smith',
    roles: ['doctor' as const],
    clinicId: 'clinic-456',
    clinicName: 'Test Clinic',
    permissions: ['read', 'write', 'prescribe'],
  };

  const mockPatient = {
    id: 'patient-789',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1985-03-15',
    gender: 'female' as const,
    insurance: {
      companyName: 'Blue Cross',
      insuranceNumber: 'BC123456',
      policyNumber: 'POL-789',
    },
    records: [],
    contact: {
      phone: '555-0123',
      email: 'jane.doe@email.com',
    },
    allergies: ['Penicillin', 'Peanuts'],
    medications: [
      {
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        active: true,
      },
    ],
    conditions: ['Hypertension', 'Type 2 Diabetes'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup network as online
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    
    // Initialize audit service
    jest.spyOn(auditTrailService, 'initialize').mockResolvedValue(undefined);
  });

  describe('Complete Patient Access Flow', () => {
    it('should handle the complete flow of accessing patient data securely', async () => {
      // Step 1: Doctor Authentication
      const { result: authResult } = renderHook(() => useAuthStore());
      
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockDoctor,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        const loginResult = await authResult.current.login(
          'dr.smith',
          'SecurePassword123!',
          'clinic-456'
        );
        expect(loginResult.success).toBe(true);
      });
      
      expect(authResult.current.isAuthenticated).toBe(true);
      expect(SecureStorageService.setAuthToken).toHaveBeenCalledWith('jwt-token-123');
      
      // Step 2: Search for Patient
      const { result: patientResult } = renderHook(() => usePatientStore());
      
      (SecureAPIClient.get as jest.Mock).mockResolvedValue({
        patients: [mockPatient],
        total: 1,
      });
      
      await act(async () => {
        await patientResult.current.searchPatients('Jane Doe');
      });
      
      expect(SecureAPIClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/patients/search'),
        expect.objectContaining({ query: 'Jane Doe' })
      );
      
      // Verify search was logged
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SEARCH',
          resourceType: 'PATIENT',
          userId: mockDoctor.id,
        })
      );
      
      // Step 3: Check Consent
      (SimpleConsentService.hasConsent as jest.Mock).mockResolvedValue(true);
      
      const hasConsent = await SimpleConsentService.hasConsent(mockPatient.id);
      expect(hasConsent).toBe(true);
      
      // Step 4: Access Patient Details
      (SecureAPIClient.get as jest.Mock).mockResolvedValue(mockPatient);
      
      await act(async () => {
        await patientResult.current.loadPatient(mockPatient.id);
      });
      
      expect(patientResult.current.selectedPatient).toEqual(mockPatient);
      
      // Verify patient access was logged
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VIEW',
          resourceType: 'PATIENT',
          resourceId: mockPatient.id,
          patientId: mockPatient.id,
          userId: mockDoctor.id,
          phiAccessed: 'Demographics, Medical History',
        })
      );
      
      // Step 5: Store in Secure Cache
      expect(SecureStorageService.setSecureItem).toHaveBeenCalledWith(
        `patient_${mockPatient.id}`,
        expect.objectContaining({
          ...mockPatient,
          cached: true,
          cacheTimestamp: expect.any(Number),
        })
      );
      
      // Step 6: Access Medical Records
      const mockMedicalRecord = {
        id: 'record-123',
        patientId: mockPatient.id,
        recordType: 'LAB' as const,
        chiefComplaint: 'Annual checkup',
        vitalSigns: {
          bloodPressure: { systolic: 120, diastolic: 80 },
          heartRate: 72,
          temperature: 98.6,
        },
        labResults: [
          {
            testName: 'HbA1c',
            value: 6.5,
            unit: '%',
            referenceRange: '4.0-5.6',
            status: 'abnormal' as const,
            date: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockDoctor.id,
      };
      
      (SecureAPIClient.get as jest.Mock).mockResolvedValue([mockMedicalRecord]);
      
      await act(async () => {
        await patientResult.current.loadMedicalRecords(mockPatient.id);
      });
      
      // Verify medical record access was logged
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VIEW',
          resourceType: 'LAB',
          resourceId: mockMedicalRecord.id,
          patientId: mockPatient.id,
          userId: mockDoctor.id,
          phiAccessed: 'Lab Results',
        })
      );
    });
  });

  describe('Offline Access Flow', () => {
    it('should handle offline patient data access with sync', async () => {
      // Setup offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
      
      const { result: authResult } = renderHook(() => useAuthStore());
      const { result: patientResult } = renderHook(() => usePatientStore());
      
      // Mock cached credentials
      (SecureStorageService.getAuthToken as jest.Mock).mockResolvedValue('cached-token');
      (SecureStorageService.getSecureItem as jest.Mock)
        .mockResolvedValueOnce({ user: mockDoctor }) // Cached user
        .mockResolvedValueOnce(mockPatient); // Cached patient
      
      // Load from cache
      await act(async () => {
        await authResult.current.checkSession();
      });
      
      expect(authResult.current.user).toEqual(mockDoctor);
      
      // Access cached patient
      await act(async () => {
        await patientResult.current.loadPatientOffline(mockPatient.id);
      });
      
      expect(patientResult.current.selectedPatient).toEqual(mockPatient);
      
      // Queue audit log for sync
      expect(auditTrailService.logAccess).toHaveBeenCalled();
      
      // Simulate coming back online
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
      
      // Trigger sync
      await act(async () => {
        await patientResult.current.syncOfflineChanges();
      });
      
      // Verify sync occurred
      expect(SecureAPIClient.post).toHaveBeenCalledWith(
        '/sync/audit',
        expect.any(Array)
      );
    });
  });

  describe('Consent Management Flow', () => {
    it('should properly handle consent workflow', async () => {
      const { result: authResult } = renderHook(() => useAuthStore());
      const { result: patientResult } = renderHook(() => usePatientStore());
      
      // Authenticate
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockDoctor,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await authResult.current.login('dr.smith', 'password', 'clinic-456');
      });
      
      // Patient without consent
      (SimpleConsentService.hasConsent as jest.Mock).mockResolvedValue(false);
      
      // Attempt to access
      await act(async () => {
        const result = await patientResult.current.loadPatient(mockPatient.id);
        expect(result).toEqual({
          success: false,
          error: 'Consent required',
        });
      });
      
      // Request consent
      (SimpleConsentService.requestConsent as jest.Mock).mockResolvedValue(true);
      
      const consentGranted = await SimpleConsentService.requestConsent(mockPatient.id);
      expect(consentGranted).toBe(true);
      
      // Log consent granted
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONSENT_GRANTED',
          resourceType: 'CONSENT',
          patientId: mockPatient.id,
        })
      );
      
      // Now can access
      (SimpleConsentService.hasConsent as jest.Mock).mockResolvedValue(true);
      (SecureAPIClient.get as jest.Mock).mockResolvedValue(mockPatient);
      
      await act(async () => {
        const result = await patientResult.current.loadPatient(mockPatient.id);
        expect(result.success).toBe(true);
      });
      
      expect(patientResult.current.selectedPatient).toEqual(mockPatient);
    });
  });

  describe('Emergency Access Flow', () => {
    it('should handle emergency override access', async () => {
      const { result: authResult } = renderHook(() => useAuthStore());
      const { result: patientResult } = renderHook(() => usePatientStore());
      
      // Authenticate as emergency doctor
      const emergencyDoctor = {
        ...mockDoctor,
        id: 'er-doctor-123',
        permissions: ['read', 'write', 'prescribe', 'emergency'],
      };
      
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: emergencyDoctor,
        token: 'jwt-token-emergency',
      });
      
      await act(async () => {
        await authResult.current.login('er.doctor', 'password', 'clinic-456');
      });
      
      // Emergency access without consent
      (SimpleConsentService.hasConsent as jest.Mock).mockResolvedValue(false);
      (SecureAPIClient.get as jest.Mock).mockResolvedValue(mockPatient);
      
      await act(async () => {
        await patientResult.current.loadPatientEmergency(
          mockPatient.id,
          'Unconscious patient, life-threatening condition'
        );
      });
      
      // Verify emergency access was specially logged
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VIEW',
          resourceType: 'PATIENT',
          patientId: mockPatient.id,
          userId: emergencyDoctor.id,
          isEmergency: true,
          reason: 'Unconscious patient, life-threatening condition',
          phiAccessed: 'Full Medical Record - Emergency Access',
        })
      );
      
      // Verify notification sent
      expect(SecureAPIClient.post).toHaveBeenCalledWith(
        '/notifications/emergency-access',
        expect.objectContaining({
          patientId: mockPatient.id,
          doctorId: emergencyDoctor.id,
          reason: expect.any(String),
        })
      );
    });
  });

  describe('Data Modification Flow', () => {
    it('should handle complete flow of modifying patient data', async () => {
      const { result: authResult } = renderHook(() => useAuthStore());
      const { result: patientResult } = renderHook(() => usePatientStore());
      
      // Authenticate
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockDoctor,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await authResult.current.login('dr.smith', 'password', 'clinic-456');
      });
      
      // Load patient
      (SecureAPIClient.get as jest.Mock).mockResolvedValue(mockPatient);
      
      await act(async () => {
        await patientResult.current.loadPatient(mockPatient.id);
      });
      
      // Modify patient data
      const updatedPatient = {
        ...mockPatient,
        medications: [
          ...mockPatient.medications,
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice daily',
            active: true,
          },
        ],
      };
      
      (SecureAPIClient.put as jest.Mock).mockResolvedValue(updatedPatient);
      
      await act(async () => {
        await patientResult.current.updatePatient(mockPatient.id, {
          medications: updatedPatient.medications,
        });
      });
      
      // Verify update was logged with before/after
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MODIFY',
          resourceType: 'MEDICATION',
          patientId: mockPatient.id,
          userId: mockDoctor.id,
          phiAccessed: 'Medication List',
          metadata: expect.objectContaining({
            before: mockPatient.medications,
            after: updatedPatient.medications,
            changeType: 'ADD_MEDICATION',
          }),
        })
      );
      
      // Verify cache was updated
      expect(SecureStorageService.setSecureItem).toHaveBeenCalledWith(
        `patient_${mockPatient.id}`,
        expect.objectContaining(updatedPatient)
      );
    });
  });

  describe('Compliance Violation Detection', () => {
    it('should detect and handle inappropriate access patterns', async () => {
      const { result: authResult } = renderHook(() => useAuthStore());
      const { result: patientResult } = renderHook(() => usePatientStore());
      
      // Authenticate as receptionist
      const receptionist = {
        ...mockDoctor,
        id: 'receptionist-123',
        roles: ['receptionist' as const],
        permissions: ['read'],
      };
      
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: receptionist,
        token: 'jwt-token-receptionist',
      });
      
      await act(async () => {
        await authResult.current.login('receptionist', 'password', 'clinic-456');
      });
      
      // Attempt to access sensitive medical records
      (SecureAPIClient.get as jest.Mock).mockRejectedValue({
        status: 403,
        message: 'Insufficient permissions',
      });
      
      await act(async () => {
        const result = await patientResult.current.loadMedicalRecords(mockPatient.id);
        expect(result.success).toBe(false);
        expect(result.error).toContain('permissions');
      });
      
      // Verify violation was logged
      expect(auditTrailService.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCESS_DENIED',
          resourceType: 'MEDICAL_RECORD',
          patientId: mockPatient.id,
          userId: receptionist.id,
          reason: 'Insufficient permissions',
          metadata: expect.objectContaining({
            violation: true,
            attemptedResource: 'MEDICAL_RECORD',
          }),
        })
      );
      
      // Verify security alert was triggered
      expect(SecureAPIClient.post).toHaveBeenCalledWith(
        '/security/alerts',
        expect.objectContaining({
          type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          userId: receptionist.id,
          resource: 'MEDICAL_RECORD',
        })
      );
    });
  });
});