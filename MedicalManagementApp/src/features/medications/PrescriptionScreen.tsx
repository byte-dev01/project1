// Add to src/features/medications/PrescriptionScreen.tsx
import { cures2Service } from '@/core/compliance/california/CURES2Service';

const handlePrescribe = async (medication: string, patient: any) => {
  // Check if controlled substance
  if (cures2Service.isControlledSubstance(medication)) {
    try {
      const validation = await cures2Service.validatePrescription({
        medication,
        patient,
        prescriberId: currentProvider.id,
        dosage,
        quantity
      });
      
      if (!validation.approved) {
        Alert.alert(
          'Prescription Blocked',
          validation.blockReason,
          [{ text: 'Request Override', onPress: requestSupervisorOverride }]
        );
        return;
      }
      
      if (validation.warnings) {
        // Show warnings but allow to proceed
        showWarnings(validation.warnings);
      }
    } catch (error) {
      Alert.alert('CURES Check Failed', 'Cannot prescribe controlled substances when CURES is unavailable');
      return;
    }
  }
  
  // Proceed with prescription
  await submitPrescription(medication);
};