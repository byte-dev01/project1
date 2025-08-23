
import { apiClient } from './ApiClient';
import { API_ENDPOINTS } from './endpoints';

interface InsuranceFormData {
  patientName: string;
  dateOfBirth: string;
  insuranceCompany: string;
  insuranceNumber: string;
  policyNumber: string;
  groupNumber?: string;
  reasonForVisit: string;
}
  interface CostEstimateResponse {
    estimatedCost: number;
    copay: number;
    deductibleRemaining: number;
  }
  interface ClaimResponse {
    claimId: string;
    status: string;
    confirmationNumber: string;
    submissionDate: string;
    claimAmount: number;
    message?: string;
    tracking: {
      confirmationNumber: string;
      referenceNumber: string;
      batchId?: string;
    };
    additionalInfoRequired?: {
      required: boolean;
      items?: string[];
      dueDate?: string;
    };
  }

interface PrefillResponse {
  insuranceCompany?: string;
  policyNumber?: string;
  groupNumber?: string;
  subscriberName?: string;
  copay?: number;
  deductible?: number;
}

  interface InsuranceVerifyResponse {
    isValid: boolean;
    coverage: {
      planName: string;
      planType: string;  // HMO, PPO, EPO, etc.
      effectiveDate: string;
      expirationDate: string;
      copay: {
        primary: number;
        specialist: number;
        emergency: number;
      };
      deductible: {
        individual: number;
        individualRemaining: number;
        family: number;
        familyRemaining: number;
      };
      outOfPocketMax: {
        individual: number;
        individualRemaining: number;
        family: number;
        familyRemaining: number;
      };
      coinsurance: number;  // Percentage (e.g., 20 for 20%)
      coverageDetails: {
        preventiveCare: boolean;
        emergencyServices: boolean;
        prescriptionDrugs: boolean;
        mentalHealth: boolean;
        dental: boolean;
        vision: boolean;
      };
    } | null;  // null if invalid
    errors?: string[];  // Any validation errors
    verificationDate: string;
    verificationId: string;
  }

  interface InsuranceClaimData {
    patientId: string;
    providerId: string;
    serviceDate: string;
    diagnosis: string;
    procedures: string[];
    amount: number;
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

    async verifyInsurance(formData: InsuranceFormData):
  Promise<InsuranceVerifyResponse> {
      const response = await apiClient.post<InsuranceVerifyResponse>(
        API_ENDPOINTS.INSURANCE.VERIFY,
        formData
      );
      return response.data;
    }
    async submitInsuranceClaim(claimData: InsuranceClaimData):
  Promise<ClaimResponse> {
      const response = await apiClient.post<ClaimResponse>(
        API_ENDPOINTS.INSURANCE.SUBMIT,
        claimData
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
  ): Promise<CostEstimateResponse> {
    const response = await apiClient.post<CostEstimateResponse>(
      '/api/insurance/estimate',
      { procedureCode, insuranceId }
    );
    return response.data;
  }
}
export const insuranceAPI = new InsuranceAPI();