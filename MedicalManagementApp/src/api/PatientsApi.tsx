import { API_ENDPOINTS } from './endpoints';
import { apiClient } from './client';
import { Patient, MedicalRecord } from '../../types/models.types';
import { PaginatedResponse } from '../../types/api.types';
import { offlineManager } from '../../utils/offline';

class PatientsAPI {
  async getPatients(page: number = 1, limit: number = 20): Promise<PaginatedResponse<Patient>> {
    const response = await apiClient.get<PaginatedResponse<Patient>>(
      API_ENDPOINTS.PATIENTS.LIST,
      { params: { page, limit } }
    );
    return response.data;
  }

  async searchPatients(query: string): Promise<Patient[]> {
    // Cache search results for offline access
    return await offlineManager.fetchWithCache(
      `patient_search_${query}`,
      async () => {
        const response = await apiClient.get<Patient[]>(
          API_ENDPOINTS.PATIENTS.SEARCH,
          { params: { q: query } }
        );
        return response.data;
      },
      {
        ttl: 10 * 60 * 1000, // 10 minutes
        offlineFallback: []
      }
    );
  }

  async getPatientById(patientId: string): Promise<Patient> {
    // Cache individual patient data for offline access
    return await offlineManager.fetchWithCache(
      `patient_${patientId}`,
      async () => {
        const response = await apiClient.get<Patient>(
          API_ENDPOINTS.PATIENTS.DETAIL(patientId)
        );
        return response.data;
      },
      {
        ttl: 30 * 60 * 1000 // 30 minutes
      }
    );
  }

  async createPatient(patientData: Partial<Patient>): Promise<Patient> {
    const response = await apiClient.post<Patient>(
      API_ENDPOINTS.PATIENTS.CREATE,
      patientData
    );
    return response.data;
  }

  async updatePatient(patientId: string, updates: Partial<Patient>): Promise<Patient> {
    // If offline, queue the update
    if (!offlineManager.getConnectionStatus()) {
      await offlineManager.addToSyncQueue({
        method: 'PUT',
        endpoint: API_ENDPOINTS.PATIENTS.UPDATE(patientId),
        data: updates
      });
      
      // Update local cache optimistically
      const cached = await offlineManager.getCachedData<Patient>(`patient_${patientId}`);
      if (cached) {
        const updated = { ...cached, ...updates };
        await offlineManager.cacheData(`patient_${patientId}`, updated);
        return updated;
      }
    }

    const response = await apiClient.put<Patient>(
      API_ENDPOINTS.PATIENTS.UPDATE(patientId),
      updates
    );
    
    // Update cache
    await offlineManager.cacheData(`patient_${patientId}`, response.data);
    return response.data;
  }

  async getPatientRecords(patientId: string): Promise<MedicalRecord[]> {
    const response = await apiClient.get<MedicalRecord[]>(
      `/api/patients/${patientId}/records`
    );
    return response.data;
  }

  async addMedication(patientId: string, medication: any): Promise<void> {
    await apiClient.post(
      `/api/patients/${patientId}/medications`,
      medication
    );
  }

  async updateMedication(patientId: string, medicationId: string, updates: any): Promise<void> {
    await apiClient.put(
      `/api/patients/${patientId}/medications/${medicationId}`,
      updates
    );
  }
}

export const patientsAPI = new PatientsAPI();
