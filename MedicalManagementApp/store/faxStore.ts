import { create } from 'zustand';
import { faxAPI } from '../src/api/fax';
import { FaxMessage, FaxStatsResponse } from '../types/models.types';
import { notificationManager } from '../utils/notifications';

interface FaxState {
  faxMessages: FaxMessage[];
  stats: {
    totalProcessed: number;
    todayProcessed: number;
    highSeverityCount: number;
    averageProcessingTime: number;
    systemStatus: 'Running' | 'Stopped' | 'Error';
  };
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  
  // Actions
  fetchFaxMessages: (timeRange?: string) => Promise<void>;
  updateFaxStatus: (faxId: string, status: FaxMessage['status'], notes?: string) => Promise<void>;
  assignFax: (faxId: string, userId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialStats = {
  totalProcessed: 0,
  todayProcessed: 0,
  highSeverityCount: 0,
  averageProcessingTime: 0,
  systemStatus: 'Running' as const,
};

export const useFaxStore = create<FaxState>((set, get) => ({
  faxMessages: [],
  stats: initialStats,
  loading: false,
  error: null,
  lastFetch: null,

  fetchFaxMessages: async (timeRange = '24h') => {
    set({ loading: true, error: null });
    
    try {
      const [faxResponse, statsResponse] = await Promise.all([
        faxAPI.getFaxRecords(timeRange),
        faxAPI.getFaxStats(timeRange),
      ]);
      
      const { faxMessages: currentMessages } = get();
      const newMessages = faxResponse.faxData || [];
      
      // Check for new urgent faxes
      const newUrgentFaxes = newMessages.filter(fax => 
        fax.severityLevel === '紧急' &&
        !currentMessages.find(current => current._id === fax._id)
      );
      
      // Send notifications for new urgent faxes
      for (const urgentFax of newUrgentFaxes) {
        await notificationManager.notifyUrgentFax(urgentFax);
      }
      
      set({
        faxMessages: newMessages,
        stats: statsResponse.stats,
        loading: false,
        lastFetch: new Date(),
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error.message || 'Failed to fetch fax messages',
      });
    }
  },

  updateFaxStatus: async (faxId, status, notes) => {
    try {
      const updatedFax = await faxAPI.updateFaxStatus(faxId, status, notes);
      
      set((state) => ({
        faxMessages: state.faxMessages.map(fax =>
          fax._id === faxId ? updatedFax : fax
        ),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to update fax status' });
      throw error;
    }
  },

  assignFax: async (faxId, userId) => {
    try {
      const updatedFax = await faxAPI.assignFax(faxId, userId);
      
      set((state) => ({
        faxMessages: state.faxMessages.map(fax =>
          fax._id === faxId ? updatedFax : fax
        ),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to assign fax' });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      faxMessages: [],
      stats: initialStats,
      loading: false,
      error: null,
      lastFetch: null,
    });
  },
}));
