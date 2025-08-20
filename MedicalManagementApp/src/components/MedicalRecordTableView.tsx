import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  Platform,
  ViewStyle,
  NativeSyntheticEvent,
} from 'react-native';

interface MedicalRecord {
  id: string;
  type: 'lab' | 'medication' | 'vital' | 'note' | 'imaging';
  title: string;
  date: number;
  value?: string | number;
  unit?: string;
  provider?: string;
  abnormal?: boolean;
  imageUrl?: string;
}

interface MedicalTableViewProps {
  data: MedicalRecord[];
  onRecordSelect?: (record: MedicalRecord) => void;
  onScroll?: (event: {
    firstVisibleIndex: number;
    lastVisibleIndex: number;
    contentOffset: number;
  }) => void;
  style?: ViewStyle;
}

export interface MedicalTableViewRef {
  scrollToRecord: (recordId: string) => void;
}

const NativeMedicalTableView = Platform.OS === 'ios'
  ? requireNativeComponent<any>('MedicalTableView')
  : null;

export const MedicalRecordTableView = forwardRef
  MedicalTableViewRef,
  MedicalTableViewProps
>((props, ref) => {
  const nativeRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    scrollToRecord: (recordId: string) => {
      if (Platform.OS === 'ios' && nativeRef.current) {
        const handle = findNodeHandle(nativeRef.current);
        if (handle) {
          UIManager.dispatchViewManagerCommand(
            handle,
            UIManager.getViewManagerConfig('MedicalTableView').Commands.scrollToRecord,
            [recordId]
          );
        }
      }
    },
  }));

  if (Platform.OS !== 'ios' || !NativeMedicalTableView) {
    // Fallback to FlatList for Android or if native component not available
    return <FallbackMedicalList {...props} />;
  }

  return (
    <NativeMedicalTableView
      ref={nativeRef}
      style={[{ flex: 1 }, props.style]}
      data={props.data}
      onRecordSelect={(event: NativeSyntheticEvent<any>) => {
        props.onRecordSelect?.(event.nativeEvent);
      }}
      onScroll={(event: NativeSyntheticEvent<any>) => {
        props.onScroll?.(event.nativeEvent);
      }}
    />
  );
});

// Fallback implementation using FlatList
const FallbackMedicalList: React.FC<MedicalTableViewProps> = (props) => {
  // Your existing FlatList implementation
  return null; // Implement your existing FlatList here
};