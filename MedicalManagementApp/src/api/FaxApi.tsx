import { API_ENDPOINTS } from './endpoints';
import { apiClient } from './client';
import { FaxMessage, FaxStatsResponse } from '../../types/models.types';
import { PaginatedResponse } from '../../types/api.types';
import { offlineManager } from '../../utils/offline';

class FaxAPI {
  async getFaxRecords(timeRange: string = '24h'): Promise<{ faxData: FaxMessage[] }> {
    // Use offline-first strategy
    return await offlineManager.fetchWithCache(
      `fax_records_${timeRange}`,
      async () => {
        const response = await apiClient.get<{ faxData: FaxMessage[] }>(
          API_ENDPOINTS.FAX.LIST,
          { params: { timeRange } }
        );
        return response.data;
      },
      {
        ttl: 5 * 60 * 1000, // 5 minutes cache
        offlineFallback: { faxData: [] }
      }
    );
  }

  async getFaxStats(timeRange: string = '24h'): Promise<FaxStatsResponse> {
    const response = await apiClient.get<FaxStatsResponse>(
      API_ENDPOINTS.FAX.STATS,
      { params: { timeRange } }
    );
    return response.data;
  }

  async getFaxDetail(faxId: string): Promise<FaxMessage> {
    const response = await apiClient.get<FaxMessage>(
      API_ENDPOINTS.FAX.DETAIL(faxId)
    );
    return response.data;
  }

  async updateFaxStatus(
    faxId: string,
    status: 'pending' | 'processed' | 'reviewed' | 'archived',
    notes?: string
  ): Promise<FaxMessage> {
    const response = await apiClient.put<FaxMessage>(
      API_ENDPOINTS.FAX.UPDATE_STATUS(faxId),
      { status, notes }
    );
    return response.data;
  }

  async assignFax(faxId: string, userId: string): Promise<FaxMessage> {
    const response = await apiClient.put<FaxMessage>(
      `${API_ENDPOINTS.FAX.DETAIL(faxId)}/assign`,
      { assignedTo: userId }
    );
    return response.data;
  }

  async searchFax(query: string, filters?: {
    severityLevel?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<FaxMessage>> {
    const response = await apiClient.get<PaginatedResponse<FaxMessage>>(
      '/api/fax/search',
      { params: { query, ...filters } }
    );
    return response.data;
  }
}

export const faxAPI = new FaxAPI();
