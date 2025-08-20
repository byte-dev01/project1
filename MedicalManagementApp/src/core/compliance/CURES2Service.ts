import { NativeModules } from 'react-native';
import { api } from '@/api/client';
import { auditLogger } from '@/services/security/auditLogger';
import { keychainService } from '@/services/security/keychainService';

/**
 * California CURES 2.0 (Controlled Substance Utilization Review and Evaluation System)
 * Mandatory checking before prescribing Schedule II-IV controlled substances
 * Required by California Health & Safety Code § 11165.4
 */
export class CURES2Service {
  private static instance: CURES2Service;
  private lastCheckCache = new Map<string, CURESCheckResult>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours per CURES guidelines
  
  // Schedule classifications
  private readonly CONTROLLED_SCHEDULES = {
    SCHEDULE_II: ['oxycodone', 'fentanyl', 'adderall', 'ritalin', 'morphine', 'hydrocodone'],
    SCHEDULE_III: ['tylenol-3', 'ketamine', 'anabolic-steroids', 'testosterone'],
    SCHEDULE_IV: ['xanax', 'valium', 'ambien', 'tramadol', 'ativan'],
    SCHEDULE_V: ['robitussin-ac', 'lyrica', 'cough-preparations'] // V is optional to check
  };

  /**
   * Check if medication requires CURES consultation
   */
  isControlledSubstance(medicationName: string): boolean {
    const normalizedName = medicationName.toLowerCase();
    
    for (const schedule of Object.values(this.CONTROLLED_SCHEDULES)) {
      if (schedule.some(drug => normalizedName.includes(drug))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Mandatory CURES check before prescribing
   * @throws Error if check fails or patient has concerning history
   */
  async performMandatoryCheck(
    patientInfo: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      driversLicense?: string;
    },
    prescriberId: string,
    medication: string,
    dosage: string,
    quantity: number
  ): Promise<CURESCheckResult> {
    try {
      // Check cache first (valid for 24 hours)
      const cacheKey = `${patientInfo.lastName}_${patientInfo.dateOfBirth}_${medication}`;
      const cached = this.lastCheckCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
        await this.logCURESAccess('CACHE_HIT', prescriberId, patientInfo, medication);
        return cached;
      }

      // Step 1: Authenticate with CURES (requires DEA number)
      const deaNumber = await keychainService.getDEANumber(prescriberId);
      if (!deaNumber) {
        throw new Error('DEA number required for CURES access');
      }

      // Step 2: Query CURES database
      const response = await api.post('/api/california/cures/query', {
        provider: {
          deaNumber,
          licenseNumber: await keychainService.getMedicalLicense(prescriberId),
          npi: prescriberId
        },
        patient: {
          firstName: patientInfo.firstName,
          lastName: patientInfo.lastName,
          dateOfBirth: patientInfo.dateOfBirth,
          driversLicense: patientInfo.driversLicense
        },
        queryType: 'PRESCRIBE_CHECK',
        medication,
        checkWindow: 12 // Check last 12 months per guidelines
      });

      const result: CURESCheckResult = {
        patientId: response.data.patientId,
        checkId: response.data.checkId,
        timestamp: Date.now(),
        prescriptionHistory: response.data.prescriptions,
        riskIndicators: this.analyzeRiskIndicators(response.data),
        doctorShoppingScore: response.data.doctorShoppingScore,
        morphineEquivalents: response.data.dailyMorphineEquivalents,
        activeControlledRx: response.data.activeControlledPrescriptions,
        requiresReview: false,
        blockedPrescription: false
      };

      // Step 3: Analyze for red flags
      const redFlags = this.checkRedFlags(result);
      
      if (redFlags.length > 0) {
        result.redFlags = redFlags;
        result.requiresReview = true;
        
        // Block if critical red flags present
        if (redFlags.some(flag => flag.severity === 'CRITICAL')) {
          result.blockedPrescription = true;
          
          // Notify supervising physician
          await this.notifySupervisor(prescriberId, patientInfo, redFlags);
        }
      }

      // Step 4: Check morphine milligram equivalents (MME)
      if (result.morphineEquivalents > 90) {
        result.requiresReview = true;
        result.mmeWarning = `Patient's daily MME is ${result.morphineEquivalents}mg. CDC recommends avoiding ≥90 MME/day.`;
        
        // Require additional documentation
        result.requiredDocumentation = [
          'pain_management_agreement',
          'naloxone_prescription',
          'urine_drug_screen'
        ];
      }

      // Step 5: Log the check (required by law)
      await this.logCURESAccess('QUERY_PERFORMED', prescriberId, patientInfo, medication);
      
      // Cache the result
      this.lastCheckCache.set(cacheKey, result);

      // Step 6: Store for audit
      await this.storeCURESCheck(result, prescriberId);

      return result;

    } catch (error) {
      // CURES check failures must be documented
      await auditLogger.logComplianceEvent('CURES_CHECK_FAILED', {
        prescriberId,
        patient: patientInfo,
        medication,
        error: error.message,
        timestamp: Date.now()
      });

      // Cannot prescribe controlled substances if CURES is down
      throw new Error('CURES check required but system unavailable. Cannot prescribe controlled substances.');
    }
  }

  /**
   * Analyze for doctor shopping and abuse patterns
   */
  private checkRedFlags(result: CURESCheckResult): RedFlag[] {
    const flags: RedFlag[] = [];

    // Multiple prescribers (doctor shopping)
    const uniquePrescribers = new Set(
      result.prescriptionHistory.map(rx => rx.prescriberId)
    ).size;

    if (uniquePrescribers >= 5) {
      flags.push({
        type: 'DOCTOR_SHOPPING',
        severity: 'CRITICAL',
        description: `Patient has received controlled substances from ${uniquePrescribers} prescribers in last 12 months`
      });
    }

    // Multiple pharmacies
    const uniquePharmacies = new Set(
      result.prescriptionHistory.map(rx => rx.pharmacyId)
    ).size;

    if (uniquePharmacies >= 5) {
      flags.push({
        type: 'PHARMACY_SHOPPING',
        severity: 'HIGH',
        description: `Patient has filled at ${uniquePharmacies} different pharmacies`
      });
    }

    // Overlapping prescriptions
    const overlapping = this.findOverlappingPrescriptions(result.prescriptionHistory);
    if (overlapping.length > 0) {
      flags.push({
        type: 'OVERLAPPING_PRESCRIPTIONS',
        severity: 'CRITICAL',
        description: 'Patient has overlapping controlled substance prescriptions',
        details: overlapping
      });
    }

    // High MME
    if (result.morphineEquivalents > 120) {
      flags.push({
        type: 'HIGH_MME',
        severity: 'HIGH',
        description: `Daily MME of ${result.morphineEquivalents}mg exceeds safe thresholds`
      });
    }

    // Early refills pattern
    const earlyRefills = result.prescriptionHistory.filter(rx => rx.earlyRefill).length;
    if (earlyRefills >= 3) {
      flags.push({
        type: 'EARLY_REFILL_PATTERN',
        severity: 'MEDIUM',
        description: `${earlyRefills} early refills in past year`
      });
    }

    return flags;
  }

  /**
   * Log CURES access (legally required)
   */
  private async logCURESAccess(
    accessType: string,
    prescriberId: string,
    patient: any,
    medication: string
  ): Promise<void> {
    await auditLogger.logComplianceEvent('CURES_ACCESS', {
      accessType,
      prescriberId,
      patientName: `${patient.lastName}, ${patient.firstName}`,
      patientDOB: patient.dateOfBirth,
      medication,
      timestamp: Date.now(),
      reportId: `CURES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }

  /**
   * Integration with prescription workflow
   */
  async validatePrescription(
    prescription: PrescriptionRequest
  ): Promise<PrescriptionValidation> {
    // Check if controlled substance
    if (!this.isControlledSubstance(prescription.medication)) {
      return { approved: true, curesCheckRequired: false };
    }

    // Perform mandatory CURES check
    const curesResult = await this.performMandatoryCheck(
      prescription.patient,
      prescription.prescriberId,
      prescription.medication,
      prescription.dosage,
      prescription.quantity
    );

    if (curesResult.blockedPrescription) {
      return {
        approved: false,
        curesCheckRequired: true,
        curesCheckId: curesResult.checkId,
        blockReason: curesResult.redFlags?.map(f => f.description).join('; '),
        requiresSupervisorOverride: true
      };
    }

    if (curesResult.requiresReview) {
      // Show warning but allow with documentation
      return {
        approved: true,
        curesCheckRequired: true,
        curesCheckId: curesResult.checkId,
        warnings: curesResult.redFlags?.map(f => f.description),
        requiredDocumentation: curesResult.requiredDocumentation,
        mmeWarning: curesResult.mmeWarning
      };
    }

    return {
      approved: true,
      curesCheckRequired: true,
      curesCheckId: curesResult.checkId
    };
  }
}

// Types
interface CURESCheckResult {
  checkId: string;
  patientId: string;
  timestamp: number;
  prescriptionHistory: PrescriptionRecord[];
  riskIndicators: string[];
  doctorShoppingScore: number;
  morphineEquivalents: number;
  activeControlledRx: number;
  requiresReview: boolean;
  blockedPrescription: boolean;
  redFlags?: RedFlag[];
  mmeWarning?: string;
  requiredDocumentation?: string[];
}

interface RedFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  details?: any;
}

export const cures2Service = new CURES2Service();