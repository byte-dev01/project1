import React, { useRef, useEffect } from 'react';
import { View, Button, Alert } from 'react-native';
import { MedicalRecordTableView, MedicalTableViewRef } from '@/components/native/MedicalRecordTableView';
import { usePatientRecords } from '@/hooks/usePatientRecords';

export const PatientMedicalHistory: React.FC<{ patientId: string }> = ({ patientId }) => {
  const tableRef = useRef<MedicalTableViewRef>(null);
  const { records, loading } = usePatientRecords(patientId);

  const handleRecordSelect = (record: any) => {
    // Audit log the access
    auditLogger.logPHIAccess('VIEW_MEDICAL_RECORD', {
      patientId,
      recordId: record.id,
      recordType: record.type,
    });

    // Navigate to detail view
    navigation.navigate('RecordDetail', { record });
  };

  const scrollToAllergies = () => {
    // Find first allergy record
    const allergyRecord = records.find(r => r.type === 'allergy');
    if (allergyRecord && tableRef.current) {
      tableRef.current.scrollToRecord(allergyRecord.id);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Button title="Jump to Allergies" onPress={scrollToAllergies} />
      
      <MedicalRecordTableView
        ref={tableRef}
        data={records}
        onRecordSelect={handleRecordSelect}
        onScroll={(event) => {
          // Track scrolling patterns for analytics
          console.log(`Viewing records ${event.firstVisibleIndex} to ${event.lastVisibleIndex}`);
        }}
      />
    </View>
  );
};