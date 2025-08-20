
import { API_ENDPOINTS } from './endpoints';
import { apiClient } from './client';
import { Insurance } from '../../types/models.types';

interface InsuranceFormData {
  patientName: string;
  dateOfBirth: string;
  insuranceCompany: string;
  insuranceNumber: string;
  policyNumber: string;
  groupNumber?: string;
  reasonForVisit: string;
}

interface PrefillResponse {
  insuranceCompany?: string;
  policyNumber?: string;
  groupNumber?: string;
  subscriberName?: string;
  copay?: number;
  deductible?: number;
}

class InsuranceAPI {
  async prefill(insuranceNumber: string): Promise<PrefillResponse> {
    try {
      const response = await apiClient.get<PrefillResponse>(
        API_ENDPOINTS.INSURANCE.PREFILL,
        { params: { insuranceNumber } }
      );
      return response.data;
    } catch (error) {
      console.error('Prefill failed:', error);
      return {};
    }
  }

  async verify(insuranceData: Partial<Insurance>): Promise<{
    isValid: boolean;
    coverage: any;
  }> {
    const response = await apiClient.post(
      API_ENDPOINTS.INSURANCE.VERIFY,
      insuranceData
    );
    return response.data;
  }

  async submit(formData: InsuranceFormData): Promise<{
    success: boolean;
    claimId?: string;
    message?: string;
  }> {
    const response = await apiClient.post(
      API_ENDPOINTS.INSURANCE.SUBMIT,
      formData
    );
    return response.data;
  }

  async getInsuranceProviders(): Promise<string[]> {
    const response = await apiClient.get<string[]>('/api/insurance/providers');
    return response.data;
  }

  async estimateCost(
    procedureCode: string,
    insuranceId: string
  ): Promise<{
    estimatedCost: number;
    copay: number;
    deductibleRemaining: number;
  }> {
    const response = await apiClient.post('/api/insurance/estimate', {
      procedureCode,
      insuranceId
    });
    return response.data;
  }
}

export const insuranceAPI = new InsuranceAPI();