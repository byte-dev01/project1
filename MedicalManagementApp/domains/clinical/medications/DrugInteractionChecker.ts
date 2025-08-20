import { api } from '@api/client';
import { auditLogger } from '@core/compliance/AuditLogger';
import { californiaCompliance } from '@core/compliance/california/CaliforniaComplianceService';

interface Drug {
  name: string;
  rxNormCode: string;
  dose: number;
  route: string;
  frequency: string;
}

interface Interaction {
  drug1: string;
  drug2: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  description: string;
  clinicalEffects: string;
  managementStrategy: string;
  documentation: 'excellent' | 'good' | 'fair' | 'poor';
}

export class DrugInteractionChecker {
  private static instance: DrugInteractionChecker;
  private interactionDatabase: Map<string, Interaction[]> = new Map();
  
  static getInstance(): DrugInteractionChecker {
    if (!DrugInteractionChecker.instance) {
      DrugInteractionChecker.instance = new DrugInteractionChecker();
    }
    return DrugInteractionChecker.instance;
  }

  /**
   * Check for drug-drug interactions
   */
  async checkInteractions(
    patientId: string,
    newDrug: Drug,
    currentMedications: Drug[]
  ): Promise<Interaction[]> {
    const interactions: Interaction[] = [];
    
    try {
      // Check each current medication against new drug
      for (const currentDrug of currentMedications) {
        const interaction = await this.checkPairwiseInteraction(
          newDrug,
          currentDrug
        );
        
        if (interaction) {
          interactions.push(interaction);
        }
      }

      // Check for cumulative effects
      const cumulativeRisks = await this.checkCumulativeEffects(
        newDrug,
        currentMedications
      );
      
      if (cumulativeRisks.length > 0) {
        interactions.push(...cumulativeRisks);
      }

      // Check California-specific requirements
      await this.checkCaliforniaRequirements(patientId, newDrug, interactions);

      // Log all interactions found
      if (interactions.length > 0) {
        await auditLogger.logClinicalDecision({
          type: 'DRUG_INTERACTION_CHECK',
          patientId,
          newDrug,
          interactionsFound: interactions.length,
          severities: interactions.map(i => i.severity),
          timestamp: new Date(),
        });
      }

      return interactions;
    } catch (error) {
      console.error('Drug interaction check failed:', error);
      throw error;
    }
  }

  /**
   * Check interaction between two drugs
   */
  private async checkPairwiseInteraction(
    drug1: Drug,
    drug2: Drug
  ): Promise<Interaction | null> {
    // Check local database first
    const cacheKey = this.getCacheKey(drug1.rxNormCode, drug2.rxNormCode);
    const cached = this.interactionDatabase.get(cacheKey);
    
    if (cached) {
      return cached[0];
    }

    // Query external drug interaction API
    try {
      const response = await api.post('/api/drug-interactions/check', {
        drug1: drug1.rxNormCode,
        drug2: drug2.rxNormCode,
      });

      if (response.data.interaction) {
        const interaction: Interaction = {
          drug1: drug1.name,
          drug2: drug2.name,
          severity: response.data.severity,
          description: response.data.description,
          clinicalEffects: response.data.clinicalEffects,
          managementStrategy: response.data.managementStrategy,
          documentation: response.data.documentation,
        };

        // Cache for future use
        this.interactionDatabase.set(cacheKey, [interaction]);
        
        return interaction;
      }
    } catch (error) {
      console.error('Failed to check drug interaction:', error);
    }

    return null;
  }

  /**
   * Check for cumulative effects (e.g., multiple anticholinergics)
   */
  private async checkCumulativeEffects(
    newDrug: Drug,
    currentMedications: Drug[]
  ): Promise<Interaction[]> {
    const interactions: Interaction[] = [];
    
    // Check for QT prolongation risk
    const qtDrugs = await this.getQTProlongingDrugs([newDrug, ...currentMedications]);
    if (qtDrugs.length >= 2) {
      interactions.push({
        drug1: qtDrugs[0].name,
        drug2: qtDrugs.slice(1).map(d => d.name).join(', '),
        severity: qtDrugs.length >= 3 ? 'major' : 'moderate',
        description: 'Multiple QT-prolonging drugs',
        clinicalEffects: 'Increased risk of torsades de pointes and sudden cardiac death',
        managementStrategy: 'Monitor ECG and electrolytes. Consider alternative medications.',
        documentation: 'excellent',
      });
    }

    // Check for serotonergic drugs
    const serotoninDrugs = await this.getSerotoninergicDrugs([newDrug, ...currentMedications]);
    if (serotoninDrugs.length >= 2) {
      interactions.push({
        drug1: serotoninDrugs[0].name,
        drug2: serotoninDrugs.slice(1).map(d => d.name).join(', '),
        severity: serotoninDrugs.length >= 3 ? 'major' : 'moderate',
        description: 'Multiple serotonergic drugs',
        clinicalEffects: 'Increased risk of serotonin syndrome',
        managementStrategy: 'Monitor for symptoms of serotonin syndrome. Consider dose reduction or alternative.',
        documentation: 'excellent',
      });
    }

    // Check for anticholinergic burden
    const anticholinergicScore = await this.calculateAnticholinergicBurden(
      [newDrug, ...currentMedications]
    );
    if (anticholinergicScore >= 3) {
      interactions.push({
        drug1: newDrug.name,
        drug2: 'Multiple medications',
        severity: anticholinergicScore >= 5 ? 'major' : 'moderate',
        description: `High anticholinergic burden (score: ${anticholinergicScore})`,
        clinicalEffects: 'Increased risk of cognitive impairment, falls, and delirium',
        managementStrategy: 'Review medications and discontinue or replace anticholinergics where possible',
        documentation: 'good',
      });
    }

    return interactions;
  }

  /**
   * Check California-specific requirements
   */
  private async checkCaliforniaRequirements(
    patientId: string,
    drug: Drug,
    interactions: Interaction[]
  ): Promise<void> {
    // Check if drug is a controlled substance
    const isControlled = await this.isControlledSubstance(drug.rxNormCode);
    
    if (isControlled) {
      // Check CURES database for patient history
      const curesHistory = await this.checkCURESDatabase(patientId);
      
      if (curesHistory.hasMultiplePrescribers) {
        interactions.push({
          drug1: drug.name,
          drug2: 'N/A',
          severity: 'major',
          description: 'Multiple prescribers detected in CURES',
          clinicalEffects: 'Potential drug seeking behavior or uncoordinated care',
          managementStrategy: 'Verify with other prescribers. Consider pain management agreement.',
          documentation: 'excellent',
        });
      }

      // Report to CURES as required by California law
      await californiaCompliance.reportControlledSubstance({
        patientId,
        drugName: drug.name,
        rxNormCode: drug.rxNormCode,
        quantity: 0, // To be filled
        daysSupply: 0, // To be filled
        date: new Date(),
      });
    }
  }

  /**
   * Get drugs that prolong QT interval
   */
  private async getQTProlongingDrugs(drugs: Drug[]): Promise<Drug[]> {
    const qtProlongingCodes = [
      '10582', // Amiodarone
      '35636', // Sotalol
      '6915',  // Methadone
      '3638',  // Erythromycin
      '2551',  // Ciprofloxacin
      // Add more as needed
    ];

    return drugs.filter(drug => 
      qtProlongingCodes.includes(drug.rxNormCode)
    );
  }

  /**
   * Get serotonergic drugs
   */
  private async getSerotoninergicDrugs(drugs: Drug[]): Promise<Drug[]> {
    const serotoninergicCodes = [
      '32937', // Paroxetine
      '36437', // Sertraline
      '3638',  // Fluoxetine
      '72625', // Duloxetine
      '39786', // Venlafaxine
      '31565', // Tramadol
      // Add more as needed
    ];

    return drugs.filter(drug => 
      serotoninergicCodes.includes(drug.rxNormCode)
    );
  }

  /**
   * Calculate anticholinergic burden score
   */
  private async calculateAnticholinergicBurden(drugs: Drug[]): Promise<number> {
    const anticholinergicScores: {[key: string]: number} = {
      '2409': 3,   // Amitriptyline
      '3361': 3,   // Diphenhydramine
      '8183': 3,   // Oxybutynin
      '42347': 2,  // Cyclobenzaprine
      '1819': 1,   // Atenolol
      '3443': 1,   // Diazepam
      // Add more as needed
    };

    let totalScore = 0;
    for (const drug of drugs) {
      totalScore += anticholinergicScores[drug.rxNormCode] || 0;
    }

    return totalScore;
  }

  /**
   * Check if drug is a controlled substance
   */
  private async isControlledSubstance(rxNormCode: string): Promise<boolean> {
    const controlledSubstances = [
      '6813',  // Morphine
      '7804',  // Oxycodone
      '3423',  // Hydrocodone
      '2670',  // Codeine
      '10689', // Tramadol
      '3443',  // Diazepam
      '679',   // Alprazolam
      // Add more as needed
    ];

    return controlledSubstances.includes(rxNormCode);
  }

  /**
   * Check California CURES database
   */
  private async checkCURESDatabase(patientId: string): Promise<{
    hasMultiplePrescribers: boolean;
    prescriptionCount: number;
    lastCheckDate: Date;
  }> {
    try {
      const response = await api.get(`/api/cures/patient/${patientId}`);
      return {
        hasMultiplePrescribers: response.data.prescriberCount > 3,
        prescriptionCount: response.data.prescriptionCount,
        lastCheckDate: new Date(response.data.lastCheck),
      };
    } catch (error) {
      console.error('CURES database check failed:', error);
      return {
        hasMultiplePrescribers: false,
        prescriptionCount: 0,
        lastCheckDate: new Date(),
      };
    }
  }

  private getCacheKey(code1: string, code2: string): string {
    return [code1, code2].sort().join('-');
  }
}

export const drugInteractionChecker = DrugInteractionChecker.getInstance();