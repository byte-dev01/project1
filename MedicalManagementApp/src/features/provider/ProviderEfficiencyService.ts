// src/features/provider/ProviderEfficiencyService.ts

import { NativeModules, Platform, Alert } from 'react-native';
import Voice from '@react-native-voice/voice';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tools that actually save doctors time
 * Focus on the 7-minute patient window reality
 */
export class ProviderEfficiencyService {
  private static instance: ProviderEfficiencyService;
  private voiceRecognitionActive = false;
  private currentPatientContext: any = null;

  // Common chief complaints with their typical workups
  private readonly QUICK_TEMPLATES = {
    'uri': {
      name: 'Upper Respiratory Infection',
      subjective: 'Patient presents with nasal congestion, sore throat, and cough for _ days.',
      objective: 'Temp: _, pharynx erythematous, no exudate. TMs clear. Lungs clear.',
      assessment: 'Viral upper respiratory infection',
      plan: 'Supportive care. Rest, fluids, acetaminophen PRN. Return if worsens or no improvement in 7-10 days.',
      orders: ['Strep test if indicated'],
      icd10: ['J06.9']
    },
    'uti': {
      name: 'Urinary Tract Infection',
      subjective: 'Dysuria, frequency, urgency for _ days. No fever, flank pain, or vaginal discharge.',
      objective: 'Afebrile. Abd soft, no CVA tenderness.',
      assessment: 'Uncomplicated UTI',
      plan: 'Antibiotics as prescribed. Increase fluids. Follow up if symptoms persist.',
      orders: ['UA with culture', 'Pregnancy test if applicable'],
      medications: ['Nitrofurantoin 100mg BID x 5 days'],
      icd10: ['N39.0']
    },
    'htn': {
      name: 'Hypertension Follow-up',
      subjective: 'Follow-up for HTN. Compliant with medications. No chest pain, SOB, or headaches.',
      objective: 'BP: _/_, HR: _, regular. Heart RRR, no murmur. Lungs clear.',
      assessment: 'Essential hypertension, _controlled',
      plan: 'Continue current medications. Low sodium diet. Exercise. Recheck in 3 months.',
      orders: ['BMP', 'Lipid panel if due'],
      icd10: ['I10']
    },
    'dm': {
      name: 'Diabetes Follow-up',
      subjective: 'DM follow-up. Checking sugars _x daily. Last A1C: _. Diet _. No hypoglycemic episodes.',
      objective: 'BP: _/_, Weight: _. Feet: no lesions, pulses intact. Monofilament intact.',
      assessment: 'Type 2 DM, _controlled. A1C at goal.',
      plan: 'Continue current regimen. Diabetic education reinforced. Eye exam if due.',
      orders: ['A1C', 'BMP', 'Lipids', 'Urine microalbumin'],
      icd10: ['E11.9']
    }
  };

  // Common medication shortcuts
  private readonly MED_SHORTCUTS = {
    'zpak': { name: 'Azithromycin', sig: '500mg day 1, then 250mg daily x 4 days', quantity: '6 tablets' },
    'augmentin': { name: 'Amoxicillin-Clavulanate', sig: '875mg BID x 10 days', quantity: '20 tablets' },
    'norco': { name: 'Hydrocodone-Acetaminophen 5-325mg', sig: '1-2 tabs q6h PRN pain', quantity: '20 tablets' },
    'medrol': { name: 'Methylprednisolone', sig: 'Dose pack as directed', quantity: '1 pack' },
    'tessalon': { name: 'Benzonatate', sig: '100mg TID PRN cough', quantity: '30 capsules' },
  };

  /**
   * Quick note generation from voice
   */
  async startVoiceNote(patientId: string): Promise<void> {
    if (!Voice) {
      Alert.alert('Voice not available', 'Voice recognition is not available on this device');
      return;
    }

    this.currentPatientContext = await this.loadPatientContext(patientId);
    
    Voice.onSpeechResults = this.onSpeechResults.bind(this);
    Voice.onSpeechError = this.onSpeechError.bind(this);

    try {
      await Voice.start('en-US');
      this.voiceRecognitionActive = true;
    } catch (error) {
      console.error('Voice start error:', error);
      Alert.alert('Voice Error', 'Failed to start voice recognition');
    }
  }

  async stopVoiceNote(): Promise<string> {
    if (!this.voiceRecognitionActive) return '';

    try {
      await Voice.stop();
      this.voiceRecognitionActive = false;
      return await this.processVoiceNote();
    } catch (error) {
      console.error('Voice stop error:', error);
      return '';
    }
  }

  private async onSpeechResults(e: any): Promise<void> {
    if (e.value && e.value[0]) {
      const text = e.value[0];
      await this.saveTranscript(text);
    }
  }

  private onSpeechError(e: any): void {
    console.error('Speech error:', e);
    this.voiceRecognitionActive = false;
  }

  private async processVoiceNote(): Promise<string> {
    const transcript = await AsyncStorage.getItem('voice_transcript');
    if (!transcript) return '';

    // Convert voice to structured note
    const note = this.structureNoteFromVoice(transcript);
    
    // Apply medical corrections
    const correctedNote = this.applyMedicalCorrections(note);
    
    return correctedNote;
  }

  private structureNoteFromVoice(transcript: string): string {
    // Smart parsing of voice input into SOAP format
    const lower = transcript.toLowerCase();
    
    let subjective = '';
    let objective = '';
    let assessment = '';
    let plan = '';

    // Extract sections based on keywords
    if (lower.includes('patient reports') || lower.includes('complains of')) {
      const subjectiveMatch = transcript.match(/(?:patient reports|complains of)(.+?)(?:on exam|examination|vital|assessment|plan|$)/i);
      if (subjectiveMatch) subjective = subjectiveMatch[1].trim();
    }

    if (lower.includes('exam') || lower.includes('vital')) {
      const objectiveMatch = transcript.match(/(?:exam|examination|vital)(.+?)(?:assessment|impression|plan|$)/i);
      if (objectiveMatch) objective = objectiveMatch[1].trim();
    }

    if (lower.includes('assessment') || lower.includes('impression')) {
      const assessmentMatch = transcript.match(/(?:assessment|impression)(.+?)(?:plan|recommend|$)/i);
      if (assessmentMatch) assessment = assessmentMatch[1].trim();
    }

    if (lower.includes('plan') || lower.includes('recommend')) {
      const planMatch = transcript.match(/(?:plan|recommend)(.+?)$/i);
      if (planMatch) plan = planMatch[1].trim();
    }

    // Format as SOAP note
    return `SUBJECTIVE:\n${subjective || transcript}\n\nOBJECTIVE:\n${objective}\n\nASSESSMENT:\n${assessment}\n\nPLAN:\n${plan}`;
  }

  private applyMedicalCorrections(text: string): string {
    // Common medical voice recognition corrections
    const corrections: {[key: string]: string} = {
      'blood pressure': 'BP',
      'heart rate': 'HR',
      'respiratory rate': 'RR',
      'temperature': 'Temp',
      'saturation': 'O2 sat',
      'twice a day': 'BID',
      'three times a day': 'TID',
      'four times a day': 'QID',
      'as needed': 'PRN',
      'by mouth': 'PO',
      'milligrams': 'mg',
      'milliliters': 'mL',
      'upper respiratory infection': 'URI',
      'urinary tract infection': 'UTI',
      'chest x-ray': 'CXR',
      'complete blood count': 'CBC',
      'basic metabolic panel': 'BMP',
    };

    let corrected = text;
    for (const [phrase, replacement] of Object.entries(corrections)) {
      const regex = new RegExp(phrase, 'gi');
      corrected = corrected.replace(regex, replacement);
    }

    return corrected;
  }

  /**
   * Quick order sets based on diagnosis
   */
  async getQuickOrderSet(diagnosis: string): Promise<any> {
    const orderSets: {[key: string]: any} = {
      'pneumonia': {
        labs: ['CBC with diff', 'BMP', 'Blood cultures x2', 'Procalcitonin'],
        imaging: ['CXR PA and lateral'],
        medications: ['Azithromycin 500mg daily', 'Ceftriaxone 1g daily'],
        other: ['O2 to maintain sat >92%', 'Incentive spirometry']
      },
      'chest_pain': {
        labs: ['Troponin', 'CBC', 'BMP', 'D-dimer', 'BNP'],
        imaging: ['EKG', 'CXR', 'Consider CTA chest if PE suspected'],
        medications: ['Aspirin 325mg', 'Nitroglycerin SL PRN'],
        monitoring: ['Telemetry', 'Serial troponins']
      },
      'cellulitis': {
        labs: ['CBC with diff', 'Blood cultures if systemic symptoms'],
        medications: ['Cephalexin 500mg QID', 'Clindamycin if MRSA suspected'],
        other: ['Mark borders', 'Elevation', 'Follow up in 48 hours']
      },
      'migraine': {
        medications: [
          'Sumatriptan 6mg SC or 100mg PO',
          'Ketorolac 30mg IM',
          'Metoclopramide 10mg IV',
          'Diphenhydramine 25mg IV'
        ],
        other: ['Dark quiet room', 'IV fluids if dehydrated']
      }
    };

    const key = diagnosis.toLowerCase().replace(/\s+/g, '_');
    return orderSets[key] || { message: 'No standard order set available' };
  }

  /**
   * Smart medication prescribing
   */
  async quickPrescribe(
    shortcut: string,
    patientAllergies: string[]
  ): Promise<any> {
    const med = this.MED_SHORTCUTS[shortcut.toLowerCase()];
    if (!med) {
      return { error: 'Unknown medication shortcut' };
    }

    // Check for allergies
    const allergyCheck = await this.checkMedicationAllergies(med.name, patientAllergies);
    if (!allergyCheck.safe) {
      return { 
        error: 'Allergy alert', 
        message: allergyCheck.message,
        alternatives: this.getSafeAlternatives(med.name, patientAllergies)
      };
    }

    return {
      medication: med.name,
      sig: med.sig,
      quantity: med.quantity,
      refills: 0,
      genericOk: true
    };
  }

  /**
   * Quick chart review summary
   */
  async getQuickSummary(patientId: string): Promise<any> {
    // Get the most important info for quick review
    const patient = await this.loadPatientContext(patientId);
    
    return {
      alerts: [
        patient.allergies?.length > 0 ? `⚠️ Allergies: ${patient.allergies.join(', ')}` : null,
        patient.conditions?.includes('diabetes') ? '🩸 Diabetic' : null,
        patient.conditions?.includes('hypertension') ? '💊 HTN' : null,
      ].filter(Boolean),
      
      lastVisit: patient.lastVisit || 'First visit',
      
      medications: patient.medications?.slice(0, 5) || [],
      
      recentLabs: patient.recentLabs || 'No recent labs',
      
      todoToday: [
        patient.dueForA1C ? '📋 A1C due' : null,
        patient.dueForRefills ? '💊 Refills needed' : null,
        patient.dueForScreening ? '🔍 Screening due' : null,
      ].filter(Boolean)
    };
  }

  /**
   * Quick documentation helpers
   */
  async applyTemplate(templateKey: string, customizations: any = {}): Promise<string> {
    const template = this.QUICK_TEMPLATES[templateKey];
    if (!template) {
      return 'Template not found';
    }

    let note = `Chief Complaint: ${template.name}\n\n`;
    note += `SUBJECTIVE:\n${template.subjective}\n\n`;
    note += `OBJECTIVE:\n${template.objective}\n\n`;
    note += `ASSESSMENT:\n${template.assessment}\n\n`;
    note += `PLAN:\n${template.plan}\n\n`;

    if (template.orders?.length > 0) {
      note += `ORDERS:\n${template.orders.map(o => `- ${o}`).join('\n')}\n\n`;
    }

    if (template.medications?.length > 0) {
      note += `MEDICATIONS:\n${template.medications.map(m => `- ${m}`).join('\n')}\n\n`;
    }

    if (template.icd10?.length > 0) {
      note += `DIAGNOSES:\n${template.icd10.map(code => `- ${code}`).join('\n')}`;
    }

    // Apply customizations
    for (const [key, value] of Object.entries(customizations)) {
      note = note.replace(new RegExp(`_${key}`, 'g'), value as string);
    }

    return note;
  }

  /**
   * Quick actions from notifications
   */
  async handleQuickAction(action: string, data: any): Promise<any> {
    switch (action) {
      case 'approve_refill':
        return this.quickRefillApproval(data.prescriptionId);
      
      case 'view_critical_lab':
        return this.openCriticalLab(data.labId);
      
      case 'sign_note':
        return this.quickSignNote(data.noteId);
      
      case 'respond_message':
        return this.quickMessageResponse(data.messageId);
      
      default:
        return { error: 'Unknown action' };
    }
  }

  // Helper methods
  private async loadPatientContext(patientId: string): Promise<any> {
    // Load patient data from storage or API
    const stored = await AsyncStorage.getItem(`patient_${patientId}`);
    return stored ? JSON.parse(stored) : {};
  }

  private async saveTranscript(text: string): Promise<void> {
    await AsyncStorage.setItem('voice_transcript', text);
  }

  private async checkMedicationAllergies(
    medication: string,
    allergies: string[]
  ): Promise<{safe: boolean; message?: string}> {
    // Simple allergy checking
    const medLower = medication.toLowerCase();
    
    for (const allergy of allergies) {
      if (medLower.includes(allergy.toLowerCase())) {
        return { 
          safe: false, 
          message: `Patient allergic to ${allergy}` 
        };
      }
    }
    
    return { safe: true };
  }

  private getSafeAlternatives(medication: string, allergies: string[]): string[] {
    // Suggest alternatives based on medication class
    const alternatives: {[key: string]: string[]} = {
      'amoxicillin': ['Azithromycin', 'Cephalexin', 'Doxycycline'],
      'penicillin': ['Azithromycin', 'Cephalexin', 'Levofloxacin'],
      'ibuprofen': ['Acetaminophen', 'Naproxen', 'Celecoxib'],
      'aspirin': ['Clopidogrel', 'Acetaminophen'],
    };

    const medLower = medication.toLowerCase();
    
    for (const [drug, alts] of Object.entries(alternatives)) {
      if (medLower.includes(drug)) {
        return alts.filter(alt => 
          !allergies.some(allergy => 
            alt.toLowerCase().includes(allergy.toLowerCase())
          )
        );
      }
    }
    
    return [];
  }

  private async quickRefillApproval(prescriptionId: string): Promise<any> {
    // Quick refill approval
    return { approved: true, prescriptionId };
  }

  private async openCriticalLab(labId: string): Promise<any> {
    // Deep link to critical lab
    return { action: 'deeplink', url: `/labs/critical/${labId}` };
  }

  private async quickSignNote(noteId: string): Promise<any> {
    // Quick note signing
    return { signed: true, noteId, timestamp: new Date() };
  }

  private async quickMessageResponse(messageId: string): Promise<any> {
    // Quick message response
    return { action: 'open_message', messageId };
  }

  static getInstance(): ProviderEfficiencyService {
    if (!ProviderEfficiencyService.instance) {
      ProviderEfficiencyService.instance = new ProviderEfficiencyService();
    }
    return ProviderEfficiencyService.instance;
  }
}

export const providerEfficiency = ProviderEfficiencyService.getInstance();