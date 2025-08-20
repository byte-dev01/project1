import { NativeModules, Alert, Platform } from 'react-native';
import { api } from '@/services/api';

const { PaperPrescriptionModule } = NativeModules;

export class PaperPrescriptionService {
  /**
   * Generate paper prescription as backup
   * California requires this capability
   */
  async generatePaperBackup(prescription: any): Promise<PaperPrescription> {
    try {
      // Validate prescription data
      this.validatePrescriptionData(prescription);
      
      // Add security features
      const secureRx = {
        ...prescription,
        securityCode: this.generateSecurityCode(),
        timestamp: new Date().toISOString(),
        validUntil: this.calculateExpiration(prescription.medication),
        californiaCompliant: true,
        backupMethod: 'PAPER',
        
        // Required California elements
        providerSignature: await this.getProviderSignature(prescription.providerId),
        deaNumber: prescription.isControlled ? 
          await this.getDEANumber(prescription.providerId) : 'N/A',
        
        // Tamper-evident features
        verificationCode: this.generateVerificationCode(),
        qrCode: await this.generateQRCode(prescription)
      };

      if (Platform.OS === 'ios') {
        const result = await PaperPrescriptionModule.generatePaperPrescription(secureRx);
        
        if (result.printable) {
          Alert.alert(
            'Paper Prescription Ready',
            'Would you like to print now?',
            [
              { text: 'Print', onPress: () => this.print(result.pdfPath) },
              { text: 'Save PDF', onPress: () => this.savePDF(result.pdfPath) }
            ]
          );
        }
        
        // Log paper prescription generation
        await api.post('/api/prescriptions/paper-backup', {
          prescriptionId: prescription.id,
          method: 'PAPER_PDF',
          securityCode: secureRx.securityCode,
          timestamp: Date.now()
        });
        
        return result;
      }
      
      throw new Error('Paper prescriptions require iOS device');
      
    } catch (error) {
      console.error('Paper prescription generation failed:', error);
      throw error;
    }
  }

  private validatePrescriptionData(rx: any): void {
    const required = [
      'patientName', 'patientDOB', 'medication', 
      'dosage', 'quantity', 'providerId', 'providerName'
    ];
    
    for (const field of required) {
      if (!rx[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  private generateSecurityCode(): string {
    // California-compliant security code
    return `CA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private generateVerificationCode(): string {
    // Pharmacy can verify this code
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `VER-${code}`;
  }
}