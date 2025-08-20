import { keychainService } from '../../services/security/keychainService';
import { api } from '../../api/client';
import { auditLogger } from '../../services/security/auditLogger';

export interface ConsentRecord {
  id: string;
  patientId: string;
  type: 'treatment' | 'payment' | 'operations' | 'marketing' | 'research' | 'psychotherapy';
  status: 'active' | 'revoked' | 'expired';
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  purpose: string;
  dataCategories: string[];
  recipients: string[];
  signature?: string;
  witnessId?: string;
}

export interface MinimumNecessaryAccess {
  userId: string;
  role: string;
  patientId: string;
  dataTypes: string[];
  purpose: string;
  validUntil: Date;
}

class ConsentManager {
  private consents: Map<string, ConsentRecord[]> = new Map();
  private accessMatrix: Map<string, MinimumNecessaryAccess> = new Map();

  async requestConsent(
    patientId: string,
    type: ConsentRecord['type'],
    purpose: string,
    dataCategories: string[]
  ): Promise<ConsentRecord> {
    // Verify patient identity first
    const verified = await this.verifyPatientIdentity(patientId);
    if (!verified) {
      throw new Error('Patient identity verification failed');
    }

    const consent: ConsentRecord = {
      id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      type,
      status: 'active',
      grantedAt: new Date(),
      expiresAt: this.calculateExpiryDate(type),
      purpose,
      dataCategories,
      recipients: [],
    };

    // Store consent record
    await api.post('/api/consent/create', consent);

    // Store locally for quick access
    const patientConsents = this.consents.get(patientId) || [];
    patientConsents.push(consent);
    this.consents.set(patientId, patientConsents);

    // Audit log
    await auditLogger.log(
      'CONSENT_GRANTED',
      'COMPLIANCE',
      {
        consentId: consent.id,
        patientId,
        type,
        purpose,
        dataCategories,
      }
    );

    return consent;
  }

  async revokeConsent(consentId: string, reason?: string): Promise<void> {
    await api.post(`/api/consent/${consentId}/revoke`, { reason });

    await auditLogger.log(
      'CONSENT_REVOKED',
      'COMPLIANCE',
      {
        consentId,
        reason,
        timestamp: Date.now(),
      }
    );
  }

  async checkDataAccess(
    userId: string,
    patientId: string,
    dataType: string,
    purpose: string
  ): Promise<boolean> {
    // Check consent exists
    const consents = this.consents.get(patientId) || [];
    const validConsent = consents.find(c =>
      c.status === 'active' &&
      c.dataCategories.includes(dataType) &&
      (!c.expiresAt || c.expiresAt > new Date())
    );

    if (!validConsent) {
      await auditLogger.log(
        'ACCESS_DENIED_NO_CONSENT',
        'SECURITY',
        { userId, patientId, dataType, purpose }
      );
      return false;
    }

    // Check minimum necessary access
    const accessKey = `${userId}_${patientId}_${dataType}`;
    const access = this.accessMatrix.get(accessKey);

    if (!access || access.validUntil < new Date()) {
      await auditLogger.log(
        'ACCESS_DENIED_MINIMUM_NECESSARY',
        'SECURITY',
        { userId, patientId, dataType, purpose }
      );
      return false;
    }

    // Log successful access
    await auditLogger.log(
      'PHI_ACCESS_GRANTED',
      'COMPLIANCE',
      {
        userId,
        patientId,
        dataType,
        purpose,
        consentId: validConsent.id,
      }
    );

    return true;
  }

  private async verifyPatientIdentity(patientId: string): Promise<boolean> {
    // Implement 2FA or biometric verification
    // This is a placeholder - implement actual verification
    return true;
  }

  private calculateExpiryDate(type: ConsentRecord['type']): Date {
    const expiryDate = new Date();
    switch (type) {
      case 'treatment':
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        break;
      case 'marketing':
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        break;
      case 'research':
        expiryDate.setFullYear(expiryDate.getFullYear() + 5);
        break;
      default:
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
    }
    return expiryDate;
  }

  // Break-glass access for emergencies
  async breakGlassAccess(
    userId: string,
    patientId: string,
    reason: string,
    witnessId?: string
  ): Promise<void> {
    if (!reason || reason.length < 50) {
      throw new Error('Break-glass access requires detailed justification');
    }

    await api.post('/api/consent/break-glass', {
      userId,
      patientId,
      reason,
      witnessId,
      timestamp: Date.now(),
    });

    await auditLogger.logSecurityEvent('BREAK_GLASS_ACCESS', {
      userId,
      patientId,
      reason,
      witnessId,
    });

    // Send immediate notification to compliance officer
    await api.post('/api/notifications/compliance-alert', {
      type: 'BREAK_GLASS',
      userId,
      patientId,
    });
  }
}

export const consentManager = new ConsentManager();
