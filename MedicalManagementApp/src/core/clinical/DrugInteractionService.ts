import { api } from '@/services/api';

export class DrugInteractionService {
  private readonly SEVERITY_LEVELS = {
    CONTRAINDICATED: 'contraindicated',
    MAJOR: 'major',
    MODERATE: 'moderate', 
    MINOR: 'minor',
    NONE: 'none'
  };

  /**
   * Check drug-drug interactions
   * Uses FDB (First Databank) or similar service
   */
  async checkInteractions(
    newMedication: string,
    currentMedications: string[],
    patientAllergies: string[] = []
  ): Promise<InteractionCheck> {
    try {
      // Check drug-drug interactions
      const drugInteractions = await this.checkDrugDrugInteractions(
        newMedication,
        currentMedications
      );

      // Check drug-allergy interactions
      const allergyInteractions = await this.checkDrugAllergyInteractions(
        newMedication,
        patientAllergies
      );

      // Check duplicate therapy
      const duplicateTherapy = await this.checkDuplicateTherapy(
        newMedication,
        currentMedications
      );

      // Compile results
      const result: InteractionCheck = {
        safe: true,
        interactions: [],
        warnings: [],
        contraindications: []
      };

      // Process drug interactions
      for (const interaction of drugInteractions) {
        if (interaction.severity === this.SEVERITY_LEVELS.CONTRAINDICATED) {
          result.safe = false;
          result.contraindications.push({
            type: 'DRUG_DRUG',
            medication1: newMedication,
            medication2: interaction.drug2,
            description: interaction.description,
            recommendation: 'DO NOT PRESCRIBE TOGETHER'
          });
        } else if (interaction.severity === this.SEVERITY_LEVELS.MAJOR) {
          result.warnings.push({
            severity: 'HIGH',
            type: 'DRUG_INTERACTION',
            message: `Major interaction with ${interaction.drug2}: ${interaction.description}`,
            monitoringRequired: true
          });
        }
        
        result.interactions.push(interaction);
      }

      // Process allergy checks
      if (allergyInteractions.length > 0) {
        result.safe = false;
        result.contraindications.push({
          type: 'ALLERGY',
          allergen: allergyInteractions[0].allergen,
          description: `Patient allergic to ${allergyInteractions[0].allergen}`,
          recommendation: 'DO NOT PRESCRIBE'
        });
      }

      // Process duplicate therapy
      if (duplicateTherapy.isDuplicate) {
        result.warnings.push({
          severity: 'MEDIUM',
          type: 'DUPLICATE_THERAPY',
          message: `Similar medication already prescribed: ${duplicateTherapy.existingDrug}`,
          monitoringRequired: false
        });
      }

      return result;

    } catch (error) {
      console.error('Drug interaction check failed:', error);
      // Fail safe - warn if check fails
      return {
        safe: false,
        interactions: [],
        warnings: [{
          severity: 'HIGH',
          type: 'SYSTEM_ERROR',
          message: 'Unable to verify drug safety. Manual verification required.',
          monitoringRequired: true
        }],
        contraindications: []
      };
    }
  }

  private async checkDrugDrugInteractions(
    drug1: string,
    otherDrugs: string[]
  ): Promise<any[]> {
    // In production, this would call FDB or RxNorm API
    const interactions = [];
    
    // Common interaction database (simplified)
    const knownInteractions = {
      'warfarin': {
        'aspirin': { severity: 'major', description: 'Increased bleeding risk' },
        'ibuprofen': { severity: 'major', description: 'Increased bleeding risk' },
        'amiodarone': { severity: 'major', description: 'Increased INR' }
      },
      'lisinopril': {
        'potassium': { severity: 'major', description: 'Hyperkalemia risk' },
        'spironolactone': { severity: 'moderate', description: 'Increased potassium' }
      },
      'metformin': {
        'contrast': { severity: 'contraindicated', description: 'Lactic acidosis risk' }
      }
    };

    const normalizedDrug = drug1.toLowerCase();
    
    for (const otherDrug of otherDrugs) {
      const normalizedOther = otherDrug.toLowerCase();
      
      if (knownInteractions[normalizedDrug]?.[normalizedOther]) {
        interactions.push({
          drug1: drug1,
          drug2: otherDrug,
          ...knownInteractions[normalizedDrug][normalizedOther]
        });
      }
    }

    return interactions;
  }

  /**
   * Check dosing safety
   */
  async checkDosing(
    medication: string,
    dose: string,
    patientAge: number,
    patientWeight?: number,
    renalFunction?: number
  ): Promise<DosingCheck> {
    // Simplified dosing checks
    const dosingLimits = {
      'acetaminophen': { maxDaily: 4000, pediatricMax: 75 }, // mg/kg/day
      'ibuprofen': { maxDaily: 3200, pediatricMax: 40 },
      'amoxicillin': { maxDaily: 3000, pediatricMax: 90 }
    };

    const limits = dosingLimits[medication.toLowerCase()];
    if (!limits) {
      return { safe: true, warnings: [] };
    }

    const warnings = [];
    
    // Pediatric dosing
    if (patientAge < 18 && patientWeight) {
      const maxPediatric = limits.pediatricMax * patientWeight;
      const prescribedDose = this.parseDose(dose);
      
      if (prescribedDose > maxPediatric) {
        warnings.push({
          type: 'PEDIATRIC_OVERDOSE',
          message: `Dose exceeds pediatric maximum of ${limits.pediatricMax}mg/kg/day`,
          recommended: `${maxPediatric}mg/day maximum`
        });
      }
    }

    // Renal adjustment
    if (renalFunction && renalFunction < 30) {
      warnings.push({
        type: 'RENAL_ADJUSTMENT',
        message: 'Dose adjustment needed for renal impairment',
        recommended: 'Reduce dose by 50%'
      });
    }

    return {
      safe: warnings.length === 0,
      warnings
    };
  }

  private parseDose(doseString: string): number {
    // Parse dose from string like "500mg twice daily"
    const match = doseString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

interface InteractionCheck {
  safe: boolean;
  interactions: any[];
  warnings: Warning[];
  contraindications: Contraindication[];
}

interface Warning {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  type: string;
  message: string;
  monitoringRequired: boolean;
}