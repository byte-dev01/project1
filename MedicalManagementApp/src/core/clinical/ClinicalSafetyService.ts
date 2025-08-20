// src/core/clinical/ClinicalSafetyService.ts

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Practical clinical safety checks
 * Focus on preventing actual harm, not theoretical issues
 */
export class ClinicalSafetyService {
  private static instance: ClinicalSafetyService;
  
  // Common drug interactions that actually matter
  private readonly CRITICAL_INTERACTIONS = {
    warfarin: ['aspirin', 'ibuprofen', 'amiodarone'],
    metformin: ['contrast', 'iodine'],
    statins: ['gemfibrozil', 'erythromycin'],
    ssri: ['maoi', 'tramadol', 'linezolid'],
  };

  // Critical allergies
  private readonly ALLERGY_CROSS_REACTIONS = {
    penicillin: ['amoxicillin', 'ampicillin', 'cephalosporin'],
    sulfa: ['sulfamethoxazole', 'furosemide', 'hydrochlorothiazide'],
    nsaid: ['ibuprofen', 'naproxen', 'ketorolac'],
  };

  /**
   * Quick drug interaction check
   * Only flag actually dangerous combinations
   */
  async checkDrugInteraction(
    newMed: string,
    currentMeds: string[]
  ): Promise<{ safe: boolean; warnings?: string[] }> {
    const warnings: string[] = [];
    const newMedLower = newMed.toLowerCase();

    // Check each current medication
    for (const currentMed of currentMeds) {
      const currentMedLower = currentMed.toLowerCase();
      
      // Check critical interactions
      for (const [drug, interactions] of Object.entries(this.CRITICAL_INTERACTIONS)) {
        if (currentMedLower.includes(drug)) {
          for (const interaction of interactions) {
            if (newMedLower.includes(interaction)) {
              warnings.push(
                `⚠️ ${newMed} may interact with ${currentMed}. Consider alternative or monitor closely.`
              );
            }
          }
        }
      }
    }

    // Check duplicate therapy
    if (this.isDuplicateTherapy(newMed, currentMeds)) {
      warnings.push(`⚠️ Duplicate therapy detected with ${newMed}`);
    }

    return {
      safe: warnings.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Allergy checking with cross-reactivity
   */
  async checkAllergies(
    medication: string,
    patientAllergies: string[]
  ): Promise<{ safe: boolean; alert?: string }> {
    const medLower = medication.toLowerCase();

    for (const allergy of patientAllergies) {
      const allergyLower = allergy.toLowerCase();
      
      // Direct allergy match
      if (medLower.includes(allergyLower)) {
        return {
          safe: false,
          alert: `🚨 ALLERGY ALERT: Patient is allergic to ${allergy}`
        };
      }

      // Cross-reactivity check
      for (const [allergen, crossReactive] of Object.entries(this.ALLERGY_CROSS_REACTIONS)) {
        if (allergyLower.includes(allergen)) {
          for (const related of crossReactive) {
            if (medLower.includes(related)) {
              return {
                safe: false,
                alert: `⚠️ POSSIBLE CROSS-REACTION: ${medication} may cross-react with ${allergy} allergy`
              };
            }
          }
        }
      }
    }

    return { safe: true };
  }

  /**
   * Dose range checking - practical limits only
   */
  async checkDoseRange(
    medication: string,
    dose: number,
    unit: string,
    patientWeight?: number,
    patientAge?: number
  ): Promise<{ appropriate: boolean; message?: string }> {
    // Common medications with clear limits
    const doseRanges: any = {
      acetaminophen: { max: 4000, unit: 'mg/day', message: 'Max 4g/day' },
      ibuprofen: { max: 3200, unit: 'mg/day', message: 'Max 3.2g/day' },
      metformin: { max: 2550, unit: 'mg/day', message: 'Max 2550mg/day' },
      lisinopril: { max: 40, unit: 'mg/day', message: 'Max 40mg/day' },
    };

    const medLower = medication.toLowerCase();
    
    for (const [drug, limits] of Object.entries(doseRanges)) {
      if (medLower.includes(drug)) {
        if (unit === limits.unit && dose > limits.max) {
          return {
            appropriate: false,
            message: `Dose exceeds maximum: ${limits.message}`
          };
        }
      }
    }

    // Pediatric dosing (simplified)
    if (patientAge && patientAge < 18) {
      return this.checkPediatricDose(medication, dose, patientWeight, patientAge);
    }

    return { appropriate: true };
  }

  /**
   * Critical lab value alerts
   */
  async checkCriticalLab(
    labType: string,
    value: number,
    unit: string
  ): Promise<{ critical: boolean; action?: string }> {
    const criticalValues: any = {
      potassium: { low: 2.5, high: 6.5, action: 'Notify physician STAT' },
      sodium: { low: 120, high: 160, action: 'Notify physician STAT' },
      glucose: { low: 40, high: 500, action: 'Check immediately, notify physician' },
      hemoglobin: { low: 7, high: 20, action: 'Consider transfusion' },
      platelet: { low: 20000, high: 1000000, action: 'Bleeding risk assessment' },
      inr: { low: 0.8, high: 5.0, action: 'Adjust anticoagulation' },
    };

    const labLower = labType.toLowerCase();
    
    if (criticalValues[labLower]) {
      const range = criticalValues[labLower];
      if (value < range.low || value > range.high) {
        return {
          critical: true,
          action: range.action
        };
      }
    }

    return { critical: false };
  }

  /**
   * Medication timing conflicts
   */
  checkMedicationTiming(
    medications: Array<{name: string; schedule: string}>
  ): { conflicts: Array<{med1: string; med2: string; issue: string}> } {
    const conflicts = [];
    
    // Check for medications that shouldn't be taken together
    const timingSeparation: any = {
      'levothyroxine': { avoid: ['calcium', 'iron'], hours: 4 },
      'bisphosphonate': { avoid: ['calcium', 'antacid'], hours: 2 },
      'fluoroquinolone': { avoid: ['antacid', 'iron', 'zinc'], hours: 2 },
    };

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        // Check if meds are scheduled at same time
        if (med1.schedule === med2.schedule) {
          for (const [drug, rules] of Object.entries(timingSeparation)) {
            if (med1.name.toLowerCase().includes(drug)) {
              for (const avoid of rules.avoid) {
                if (med2.name.toLowerCase().includes(avoid)) {
                  conflicts.push({
                    med1: med1.name,
                    med2: med2.name,
                    issue: `Separate by ${rules.hours} hours`
                  });
                }
              }
            }
          }
        }
      }
    }

    return { conflicts };
  }

  /**
   * Clinical decision support - simple rules that matter
   */
  async getClinicalReminders(patient: any): Promise<string[]> {
    const reminders = [];
    const age = this.calculateAge(patient.birthDate);

    // Diabetes management
    if (patient.conditions?.includes('diabetes')) {
      if (!patient.lastA1C || this.daysSince(patient.lastA1C) > 90) {
        reminders.push('📋 A1C due (>3 months)');
      }
      if (!patient.lastEyeExam || this.daysSince(patient.lastEyeExam) > 365) {
        reminders.push('👁️ Annual diabetic eye exam due');
      }
    }

    // Hypertension management
    if (patient.conditions?.includes('hypertension')) {
      if (!patient.lastCreatinine || this.daysSince(patient.lastCreatinine) > 365) {
        reminders.push('🧪 Annual kidney function test due');
      }
    }

    // Age-based screenings
    if (age >= 50 && !patient.lastColonoscopy) {
      reminders.push('🔍 Colonoscopy screening recommended');
    }
    
    if (age >= 40 && patient.gender === 'F' && 
        (!patient.lastMammogram || this.daysSince(patient.lastMammogram) > 365)) {
      reminders.push('🩺 Annual mammogram due');
    }

    // Vaccination reminders
    const fluSeason = new Date().getMonth() >= 8 || new Date().getMonth() <= 2;
    if (fluSeason && (!patient.lastFluShot || this.daysSince(patient.lastFluShot) > 180)) {
      reminders.push('💉 Flu vaccine recommended');
    }

    return reminders;
  }

  /**
   * Override tracking for safety alerts
   */
  async overrideSafetyAlert(
    alertType: string,
    reason: string,
    providerId: string
  ): Promise<void> {
    const override = {
      timestamp: new Date().toISOString(),
      type: alertType,
      reason,
      providerId,
      deviceId: await this.getDeviceId()
    };

    // Store override for audit
    const overrides = await this.getStoredOverrides();
    overrides.push(override);
    await AsyncStorage.setItem('safety_overrides', JSON.stringify(overrides));

    // Alert if too many overrides
    const recentOverrides = overrides.filter(o => 
      this.daysSince(o.timestamp) < 30
    );
    
    if (recentOverrides.length > 10) {
      Alert.alert(
        'Safety Notice',
        'Multiple safety overrides detected. Consider reviewing clinical protocols.'
      );
    }
  }

  // Helper methods
  private isDuplicateTherapy(newMed: string, currentMeds: string[]): boolean {
    // Simple therapeutic duplication check
    const drugClasses: any = {
      statin: ['atorvastatin', 'simvastatin', 'rosuvastatin'],
      ppi: ['omeprazole', 'esomeprazole', 'pantoprazole'],
      ssri: ['sertraline', 'fluoxetine', 'citalopram'],
      ace: ['lisinopril', 'enalapril', 'ramipril'],
    };

    for (const [className, drugs] of Object.entries(drugClasses)) {
      let count = 0;
      for (const drug of drugs as string[]) {
        if (newMed.toLowerCase().includes(drug)) count++;
        for (const current of currentMeds) {
          if (current.toLowerCase().includes(drug)) count++;
        }
      }
      if (count > 1) return true;
    }
    
    return false;
  }

  private checkPediatricDose(
    medication: string,
    dose: number,
    weight?: number,
    age?: number
  ): { appropriate: boolean; message?: string } {
    if (!weight) {
      return { 
        appropriate: false, 
        message: 'Weight required for pediatric dosing' 
      };
    }

    // Simple weight-based dosing for common meds
    const pedDosing: any = {
      acetaminophen: { max: 15, unit: 'mg/kg/dose' },
      ibuprofen: { max: 10, unit: 'mg/kg/dose' },
      amoxicillin: { max: 50, unit: 'mg/kg/day' },
    };

    const medLower = medication.toLowerCase();
    
    for (const [drug, limits] of Object.entries(pedDosing)) {
      if (medLower.includes(drug)) {
        const maxDose = weight * limits.max;
        if (dose > maxDose) {
          return {
            appropriate: false,
            message: `Exceeds pediatric max of ${limits.max} ${limits.unit}`
          };
        }
      }
    }

    return { appropriate: true };
  }

  private calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  private daysSince(date: string): number {
    const then = new Date(date);
    const now = new Date();
    const diff = now.getTime() - then.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private async getDeviceId(): Promise<string> {
    return await AsyncStorage.getItem('device_id') || 'unknown';
  }

  private async getStoredOverrides(): Promise<any[]> {
    const stored = await AsyncStorage.getItem('safety_overrides');
    return stored ? JSON.parse(stored) : [];
  }

  static getInstance(): ClinicalSafetyService {
    if (!ClinicalSafetyService.instance) {
      ClinicalSafetyService.instance = new ClinicalSafetyService();
    }
    return ClinicalSafetyService.instance;
  }
}

export const clinicalSafety = ClinicalSafetyService.getInstance();