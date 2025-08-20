// src/hooks/useAuditedAction.ts
import { useAuth } from './useAuth'; // Your existing JWT hook
import { auditLog } from '../core/compliance/AuditLogService';

/**
 * Simple hook that combines your JWT auth with audit logging
 * Use this everywhere you access patient data
 */
export const useAuditedAction = () => {
  const { user, token } = useAuth(); // Your existing JWT data
  
  // Extract user info from JWT
  const userId = user?.id || user?.email;
  const userRole = user?.role || 'unknown';
  const department = user?.department;
  
  /**
   * Log any view action
   */
  const logView = async (patientId: string, resourceType: string, metadata?: any) => {
    try {
      await auditLog.log({
        userId,
        userRole,
        department,
        patientId,
        action: 'VIEW',
        resourceType,
        purpose: 'TREATMENT', // Change based on context
        authMethod: 'jwt',
        metadata: {
          ...metadata,
          tokenExp: user?.exp, // JWT expiration
          sessionStart: user?.iat, // JWT issued at
        }
      });
    } catch (error) {
      console.error('Audit log failed:', error);
      // Never break the app for audit failures
    }
  };
  
  /**
   * Log any data change
   */
  const logChange = async (
    patientId: string, 
    resourceType: string, 
    changeType: 'CREATE' | 'UPDATE' | 'DELETE',
    oldValue?: any,
    newValue?: any
  ) => {
    try {
      await auditLog.log({
        userId,
        userRole,
        department,
        patientId,
        action: changeType,
        resourceType,
        purpose: 'TREATMENT',
        authMethod: 'jwt',
        metadata: {
          oldValue: oldValue ? JSON.stringify(oldValue).substring(0, 100) : null,
          newValue: newValue ? JSON.stringify(newValue).substring(0, 100) : null,
          changeType,
        }
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  };
  
  /**
   * Log search actions (for detecting inappropriate access)
   */
  const logSearch = async (searchTerm: string, resultCount: number) => {
    try {
      await auditLog.log({
        userId,
        userRole,
        department,
        action: 'SEARCH',
        resourceType: 'PATIENT_DATABASE',
        purpose: 'TREATMENT',
        authMethod: 'jwt',
        metadata: {
          searchTerm: searchTerm.substring(0, 3), // Only first 3 chars for privacy
          resultCount,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  };
  
  /**
   * Check for weird behaviors based on role
   */
  const checkWeirdBehavior = async (action: string, context: any) => {
    const warnings = [];
    
    // Check 1: Receptionist accessing clinical data
    if (userRole === 'receptionist' && 
        ['PRESCRIPTION', 'LAB_RESULTS', 'DIAGNOSIS'].includes(context.resourceType)) {
      warnings.push('RECEPTIONIST_CLINICAL_ACCESS');
    }
    
    // Check 2: After hours access (not for doctors)
    const hour = new Date().getHours();
    if (userRole !== 'doctor' && (hour < 7 || hour > 19)) {
      warnings.push('AFTER_HOURS_NON_DOCTOR');
    }
    
    // Check 3: Accessing too many records quickly
    const recentAccessCount = await getRecentAccessCount(userId);
    if (recentAccessCount > 50) {
      warnings.push('EXCESSIVE_ACCESS_RATE');
    }
    
    // Check 4: Accessing patient not assigned to user
    if (userRole === 'nurse' && !await isAssignedPatient(userId, context.patientId)) {
      warnings.push('UNASSIGNED_PATIENT_ACCESS');
    }
    
    // Log warnings if any
    if (warnings.length > 0) {
      await auditLog.log({
        userId,
        userRole,
        action: 'SUSPICIOUS_BEHAVIOR',
        resourceType: 'SECURITY_ALERT',
        purpose: 'SECURITY',
        metadata: {
          warnings,
          context,
          severity: warnings.includes('EXCESSIVE_ACCESS_RATE') ? 'HIGH' : 'MEDIUM'
        }
      });
      
      // Could also trigger immediate alerts here
      if (warnings.includes('EXCESSIVE_ACCESS_RATE')) {
        // Send alert to security team
        await sendSecurityAlert(userId, warnings);
      }
    }
    
    return warnings;
  };
  
  return {
    logView,
    logChange,
    logSearch,
    checkWeirdBehavior,
    userId,
    userRole
  };
};

// ============================================
// INTEGRATION WITH YOUR EXISTING SCREENS
// ============================================

// Example 1: Prescription Screen with JWT + Audit
export const PrescriptionScreen = () => {
  const { logView, logChange, checkWeirdBehavior, userRole } = useAuditedAction();
  const [prescriptions, setPrescriptions] = useState([]);
  
  // Load prescriptions with audit logging
  const loadPrescriptions = async (patientId: string) => {
    // Log the view action
    await logView(patientId, 'PRESCRIPTION', {
      screen: 'PrescriptionScreen',
      action: 'initial_load'
    });
    
    // Check for weird behavior
    const warnings = await checkWeirdBehavior('VIEW', {
      resourceType: 'PRESCRIPTION',
      patientId
    });
    
    if (warnings.length > 0) {
      console.warn('Suspicious activity detected:', warnings);
      // Could show warning to user or lock access
    }
    
    // Load actual data
    const data = await api.getPrescriptions(patientId);
    setPrescriptions(data);
  };
  
  // Update prescription with audit logging
  const updatePrescription = async (prescriptionId: string, updates: any) => {
    const oldPrescription = prescriptions.find(p => p.id === prescriptionId);
    
    // Log the change
    await logChange(
      oldPrescription.patientId,
      'PRESCRIPTION',
      'UPDATE',
      oldPrescription,
      { ...oldPrescription, ...updates }
    );
    
    // Make the actual update
    await api.updatePrescription(prescriptionId, updates);
  };
  
  return (
    <View>
      {/* Your UI */}
    </View>
  );
};

// Example 2: Patient Search with Audit
export const PatientSearchScreen = () => {
  const { logSearch, logView, userRole } = useAuditedAction();
  
  const searchPatients = async (searchTerm: string) => {
    // Log the search
    const results = await api.searchPatients(searchTerm);
    await logSearch(searchTerm, results.length);
    
    // If someone searches for celebrity names, flag it
    const celebrityNames = ['kardashian', 'bieber', 'swift', 'drake'];
    if (celebrityNames.some(name => searchTerm.toLowerCase().includes(name))) {
      await auditLog.log({
        userId: getCurrentUserId(),
        action: 'CELEBRITY_SEARCH',
        resourceType: 'SECURITY_ALERT',
        purpose: 'SECURITY',
        metadata: { searchTerm, flagged: true }
      });
    }
    
    return results;
  };
  
  const selectPatient = async (patient: Patient) => {
    // Log viewing patient from search
    await logView(patient.id, 'DEMOGRAPHICS', {
      accessedVia: 'search',
      searchToSelectTime: Date.now()
    });
    
    navigation.navigate('PatientDetail', { patientId: patient.id });
  };
  
  return (
    <View>
      {/* Search UI */}
    </View>
  );
};

// ============================================
// ROLE-BASED WEIRD BEHAVIOR DETECTION
// ============================================

class RoleBasedSecurityMonitor {
  // Define what's normal for each role
  private rolePermissions = {
    doctor: {
      allowedResources: ['ALL'],
      allowedHours: [0, 24], // 24/7 access
      maxRecordsPerHour: 200,
      canExport: true,
      canDelete: false
    },
    nurse: {
      allowedResources: ['VITALS', 'MEDICATIONS', 'NOTES'],
      allowedHours: [6, 22], // 6 AM - 10 PM
      maxRecordsPerHour: 100,
      canExport: false,
      canDelete: false
    },
    receptionist: {
      allowedResources: ['DEMOGRAPHICS', 'INSURANCE', 'APPOINTMENTS'],
      allowedHours: [7, 19], // 7 AM - 7 PM
      maxRecordsPerHour: 50,
      canExport: false,
      canDelete: false
    },
    admin: {
      allowedResources: ['AUDIT_LOG', 'USER_MANAGEMENT', 'REPORTS'],
      allowedHours: [8, 18], // 8 AM - 6 PM
      maxRecordsPerHour: 500,
      canExport: true,
      canDelete: false
    }
  };
  
  async detectAnomalies(event: AuditEvent): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    const role = event.userRole || 'unknown';
    const permissions = this.rolePermissions[role];
    
    if (!permissions) {
      alerts.push({
        type: 'UNKNOWN_ROLE',
        severity: 'HIGH',
        description: `Unknown role: ${role}`
      });
      return alerts;
    }
    
    // Check 1: Resource access permission
    if (!permissions.allowedResources.includes('ALL') && 
        !permissions.allowedResources.includes(event.resourceType)) {
      alerts.push({
        type: 'UNAUTHORIZED_RESOURCE_ACCESS',
        severity: 'HIGH',
        description: `${role} accessed ${event.resourceType}`
      });
    }
    
    // Check 2: Time-based access
    const hour = new Date().getHours();
    if (hour < permissions.allowedHours[0] || hour > permissions.allowedHours[1]) {
      alerts.push({
        type: 'AFTER_HOURS_ACCESS',
        severity: 'MEDIUM',
        description: `${role} accessed system at ${hour}:00`
      });
    }
    
    // Check 3: Volume-based detection
    const recentAccess = await this.getHourlyAccessCount(event.userId);
    if (recentAccess > permissions.maxRecordsPerHour) {
      alerts.push({
        type: 'EXCESSIVE_ACCESS',
        severity: 'HIGH',
        description: `${role} accessed ${recentAccess} records in 1 hour`
      });
    }
    
    // Check 4: Action-based permissions
    if (event.action === 'EXPORT' && !permissions.canExport) {
      alerts.push({
        type: 'UNAUTHORIZED_EXPORT',
        severity: 'CRITICAL',
        description: `${role} attempted data export`
      });
    }
    
    if (event.action === 'DELETE' && !permissions.canDelete) {
      alerts.push({
        type: 'UNAUTHORIZED_DELETE',
        severity: 'CRITICAL',
        description: `${role} attempted deletion`
      });
    }
    
    return alerts;
  }
}

// ============================================
// SIMPLIFIED MIDDLEWARE FOR ALL API CALLS
// ============================================

export const auditedApiClient = {
  // Wrap your existing API client
  get: async (url: string, options?: any) => {
    const { userId, userRole } = getCurrentUser(); // From JWT
    
    // Log API access
    await auditLog.log({
      userId,
      userRole,
      action: 'API_GET',
      resourceType: 'API',
      purpose: 'OPERATIONS',
      metadata: { url, method: 'GET' }
    });
    
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        'X-Audit-User': userId,
        'X-Audit-Role': userRole,
        'X-Audit-Session': getSessionId()
      }
    });
  },
  
  post: async (url: string, data: any, options?: any) => {
    const { userId, userRole } = getCurrentUser();
    
    // Detect what type of change
    let action = 'CREATE';
    if (url.includes('update')) action = 'UPDATE';
    if (url.includes('delete')) action = 'DELETE';
    
    await auditLog.log({
      userId,
      userRole,
      action,
      resourceType: 'API',
      purpose: 'OPERATIONS',
      metadata: { 
        url, 
        method: 'POST',
        dataSize: JSON.stringify(data).length
      }
    });
    
    return fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  }
};

// ============================================
// SIMPLE SETUP IN YOUR APP.TSX
// ============================================

export const App = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    // Set up global audit context when user logs in
    if (user) {
      // Log successful login
      auditLog.log({
        userId: user.id,
        userRole: user.role,
        action: 'LOGIN',
        resourceType: 'AUDIT_LOG',
        purpose: 'OPERATIONS',
        authMethod: 'jwt',
        metadata: {
          loginTime: Date.now(),
          tokenExpiry: user.exp,
          loginIP: user.ip
        }
      });
      
      // Start monitoring for weird behavior
      const monitor = new RoleBasedSecurityMonitor();
      
      // Check every action against role permissions
      globalAuditMonitor.setUser({
        id: user.id,
        role: user.role,
        department: user.department
      });
    }
  }, [user]);
  
  // Auto-log logout
  useEffect(() => {
    return () => {
      if (user) {
        auditLog.log({
          userId: user.id,
          action: 'LOGOUT',
          resourceType: 'AUDIT_LOG',
          purpose: 'OPERATIONS'
        });
      }
    };
  }, [user]);
  
  return <YourAppNavigator />;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Track access velocity
const accessCounter = new Map();

async function getRecentAccessCount(userId: string): Promise<number> {
  const key = `${userId}_${Math.floor(Date.now() / 3600000)}`; // Per hour
  return accessCounter.get(key) || 0;
}

async function incrementAccessCount(userId: string): Promise<void> {
  const key = `${userId}_${Math.floor(Date.now() / 3600000)}`;
  const current = accessCounter.get(key) || 0;
  accessCounter.set(key, current + 1);
  
  // Clean old entries
  for (const [k, v] of accessCounter.entries()) {
    if (!k.includes(Math.floor(Date.now() / 3600000).toString())) {
      accessCounter.delete(k);
    }
  }
}

// Check if patient is assigned to user
async function isAssignedPatient(userId: string, patientId: string): Promise<boolean> {
  // This would check your database
  // For now, return true to not block access
  return true;
}

// Send security alerts
async function sendSecurityAlert(userId: string, warnings: string[]): Promise<void> {
  // In production, this would email/SMS/Slack your security team
  console.error('🚨 SECURITY ALERT:', { userId, warnings });
  
  // Could also lock the account
  if (warnings.includes('EXCESSIVE_ACCESS_RATE')) {
    // await lockUserAccount(userId);
  }
}