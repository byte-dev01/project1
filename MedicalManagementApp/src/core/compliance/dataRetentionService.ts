import { api } from '../../api/client';
import { auditLogger } from '../../services/security/auditLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RetentionPolicy {
  dataType: string;
  retentionPeriod: number; // in days
  legalBasis: string;
  autoDelete: boolean;
}

class DataRetentionService {
  private policies: RetentionPolicy[] = [
    { dataType: 'medical_records', retentionPeriod: 2555, legalBasis: 'HIPAA', autoDelete: false }, // 7 years
    { dataType: 'audit_logs', retentionPeriod: 2190, legalBasis: 'HIPAA', autoDelete: false }, // 6 years
    { dataType: 'consent_records', retentionPeriod: 2190, legalBasis: 'HIPAA', autoDelete: false },
    { dataType: 'billing_records', retentionPeriod: 2555, legalBasis: 'IRS', autoDelete: false },
    { dataType: 'cache_data', retentionPeriod: 30, legalBasis: 'Performance', autoDelete: true },
    { dataType: 'session_data', retentionPeriod: 1, legalBasis: 'Security', autoDelete: true },
  ];

  async enforceRetentionPolicies(): Promise<void> {
    for (const policy of this.policies) {
      if (policy.autoDelete) {
        await this.deleteExpiredData(policy);
      } else {
        await this.archiveExpiredData(policy);
      }
    }
  }

  private async deleteExpiredData(policy: RetentionPolicy): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

    await api.post('/api/retention/delete', {
      dataType: policy.dataType,
      cutoffDate,
    });

    await auditLogger.log(
      'DATA_RETENTION_CLEANUP',
      'COMPLIANCE',
      {
        dataType: policy.dataType,
        cutoffDate,
        action: 'delete',
      }
    );
  }

  private async archiveExpiredData(policy: RetentionPolicy): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

    await api.post('/api/retention/archive', {
      dataType: policy.dataType,
      cutoffDate,
    });
  }

  async handleRightToErasure(patientId: string, verificationType: 'court_order' | 'patient_request'): Promise<void> {
    // Verify legal basis for erasure
    if (verificationType === 'patient_request') {
      const hasLegalHold = await this.checkLegalHold(patientId);
      if (hasLegalHold) {
        throw new Error('Cannot delete data under legal hold');
      }
    }

    // Create deletion record before deletion
    const deletionRecord = {
      patientId,
      requestDate: new Date(),
      verificationType,
      dataCategories: await this.getPatientDataCategories(patientId),
    };

    await api.post('/api/retention/deletion-record', deletionRecord);

    // Perform deletion
    await api.delete(`/api/patients/${patientId}/all-data`);

    // Clear local storage
    await this.clearLocalPatientData(patientId);

    await auditLogger.logSecurityEvent('RIGHT_TO_ERASURE_EXECUTED', {
      patientId,
      verificationType,
      timestamp: Date.now(),
    });
  }

  private async checkLegalHold(patientId: string): Promise<boolean> {
    const response = await api.get(`/api/legal/hold-status/${patientId}`);
    return response.data.hasHold;
  }

  private async getPatientDataCategories(patientId: string): Promise<string[]> {
    const response = await api.get(`/api/patients/${patientId}/data-categories`);
    return response.data;
  }

  private async clearLocalPatientData(patientId: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const patientKeys = keys.filter(key => key.includes(patientId));
    await AsyncStorage.multiRemove(patientKeys);
  }
}

export const dataRetentionService = new DataRetentionService();
