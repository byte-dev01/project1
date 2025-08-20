import { api } from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auditLogger } from '../../services/security/auditLogger';

interface VectorClock {
  [nodeId: string]: number;
}

interface CRDTOperation {
  id: string;
  type: 'add' | 'remove' | 'update';
  path: string;
  value: any;
  timestamp: number;
  vectorClock: VectorClock;
  userId: string;
}

interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual' | 'clinical-priority';
  resolved: boolean;
  result?: any;
  requiresReview?: boolean;
}

class ConflictResolutionService {
  private nodeId: string;
  private vectorClock: VectorClock = {};
  private pendingOperations: CRDTOperation[] = [];

  constructor() {
    this.nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.vectorClock[this.nodeId] = 0;
  }

  async resolveConflicts(
    localData: any,
    remoteData: any,
    dataType: string
  ): Promise<ConflictResolution> {
    // Determine resolution strategy based on data type
    const strategy = this.getResolutionStrategy(dataType);

    switch (strategy) {
      case 'clinical-priority':
        return this.resolveClinicalConflict(localData, remoteData);
      case 'merge':
        return this.mergeConflicts(localData, remoteData);
      case 'last-write-wins':
        return this.lastWriteWins(localData, remoteData);
      default:
        return this.manualResolution(localData, remoteData);
    }
  }

  private getResolutionStrategy(dataType: string): ConflictResolution['strategy'] {
    // Critical medical data requires special handling
    const clinicalPriorityTypes = [
      'allergies',
      'medications',
      'vital_signs',
      'diagnoses',
    ];

    if (clinicalPriorityTypes.includes(dataType)) {
      return 'clinical-priority';
    }

    const mergeableTypes = [
      'notes',
      'appointments',
      'messages',
    ];

    if (mergeableTypes.includes(dataType)) {
      return 'merge';
    }

    return 'last-write-wins';
  }

  private async resolveClinicalConflict(
    localData: any,
    remoteData: any
  ): Promise<ConflictResolution> {
    // Clinical data prioritizes safety
    const resolution: ConflictResolution = {
      strategy: 'clinical-priority',
      resolved: false,
      requiresReview: true,
    };

    // Merge allergies (union - keep all)
    if (localData.allergies && remoteData.allergies) {
      const allAllergies = new Set([
        ...localData.allergies,
        ...remoteData.allergies,
      ]);
      resolution.result = { allergies: Array.from(allAllergies) };
      resolution.resolved = true;
    }

    // Medications require provider review for conflicts
    if (localData.medications && remoteData.medications) {
      const localMeds = new Map(localData.medications.map((m: any) => [m.id, m]));
      const remoteMeds = new Map(remoteData.medications.map((m: any) => [m.id, m]));
      
      const conflicts = [];
      for (const [id, localMed] of localMeds) {
        const remoteMed = remoteMeds.get(id);
        if (remoteMed && JSON.stringify(localMed) !== JSON.stringify(remoteMed)) {
          conflicts.push({ local: localMed, remote: remoteMed });
        }
      }

      if (conflicts.length > 0) {
        await this.flagForClinicalReview(conflicts);
        resolution.requiresReview = true;
      }
    }

    await auditLogger.log(
      'CLINICAL_CONFLICT_RESOLUTION',
      'DATA_MODIFY',
      {
        resolved: resolution.resolved,
        requiresReview: resolution.requiresReview,
      }
    );

    return resolution;
  }

  private mergeConflicts(
    localData: any,
    remoteData: any
  ): ConflictResolution {
    // Three-way merge
    const merged = this.threeWayMerge(
      localData,
      remoteData,
      this.getCommonAncestor(localData, remoteData)
    );

    return {
      strategy: 'merge',
      resolved: true,
      result: merged,
    };
  }

  private threeWayMerge(local: any, remote: any, ancestor: any): any {
    const result: any = {};

    // Get all keys
    const allKeys = new Set([
      ...Object.keys(local || {}),
      ...Object.keys(remote || {}),
      ...Object.keys(ancestor || {}),
    ]);

    for (const key of allKeys) {
      const localValue = local?.[key];
      const remoteValue = remote?.[key];
      const ancestorValue = ancestor?.[key];

      if (localValue === remoteValue) {
        // No conflict
        result[key] = localValue;
      } else if (localValue === ancestorValue) {
        // Remote changed
        result[key] = remoteValue;
      } else if (remoteValue === ancestorValue) {
        // Local changed
        result[key] = localValue;
      } else {
        // Both changed - need resolution
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          // Merge arrays
          result[key] = [...new Set([...localValue, ...remoteValue])];
        } else if (typeof localValue === 'object' && typeof remoteValue === 'object') {
          // Recursive merge
          result[key] = this.threeWayMerge(localValue, remoteValue, ancestorValue);
        } else {
          // Take local (could be configured)
          result[key] = localValue;
        }
      }
    }

    return result;
  }

  private lastWriteWins(
    localData: any,
    remoteData: any
  ): ConflictResolution {
    const localTimestamp = localData._timestamp || 0;
    const remoteTimestamp = remoteData._timestamp || 0;

    return {
      strategy: 'last-write-wins',
      resolved: true,
      result: localTimestamp > remoteTimestamp ? localData : remoteData,
    };
  }

  private manualResolution(
    localData: any,
    remoteData: any
  ): ConflictResolution {
    return {
      strategy: 'manual',
      resolved: false,
      requiresReview: true,
    };
  }

  private getCommonAncestor(local: any, remote: any): any {
    // Simplified - in production, maintain version history
    return {};
  }

  private async flagForClinicalReview(conflicts: any[]): Promise<void> {
    await api.post('/api/conflicts/clinical-review', {
      conflicts,
      timestamp: Date.now(),
      nodeId: this.nodeId,
    });
  }

  // Vector clock operations
  incrementClock(): void {
    this.vectorClock[this.nodeId]++;
  }

  compareClocks(clock1: VectorClock, clock2: VectorClock): 'before' | 'after' | 'concurrent' {
    let hasGreater = false;
    let hasLess = false;

    const allNodes = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const node of allNodes) {
      const v1 = clock1[node] || 0;
      const v2 = clock2[node] || 0;

      if (v1 > v2) hasGreater = true;
      if (v1 < v2) hasLess = true;
    }

    if (hasGreater && !hasLess) return 'after';
    if (!hasGreater && hasLess) return 'before';
    return 'concurrent';
  }
}

export const conflictResolutionService = new ConflictResolutionService();
