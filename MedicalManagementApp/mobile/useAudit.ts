
import { LocalAuditService } from '../services/LocalAuditService';
import { useAuth } from './useAuth';

const auditService = new LocalAuditService();

export const useAudit = () => {
  const { user } = useAuth();
  
  const log = async (action: string, resourceType: string, metadata?: any) => {
    await auditService.logLocal({
      userId: user.id,
      userRole: user.role,
      action,
      resourceType,
      deviceId: DeviceInfo.getUniqueId(),
      sessionId: user.sessionId,
      authMethod: 'jwt',
      ...metadata
    });
  };
  
  return { log };
};

// Usage in component
export const PrescriptionScreen = () => {
  const { log } = useAudit();
  
  const viewPrescription = async (patientId: string) => {
    // Log locally (instant)
    await log('VIEW', 'PRESCRIPTION', { patientId });
    
    // Fetch data
    const data = await api.getPrescriptions(patientId);
    
    // Will sync to Prisma server automatically in background
    return data;
  };
};