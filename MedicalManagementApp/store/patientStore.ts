import { create } from 'zustand';
import { patientsAPI } from '../src/api/patients';
import { Patient } from '../types/models.types';
import { offlineManager } from '../utils/offline';

interface PatientState {
  patients: Patient[];
  selectedPatient: Patient | null;
  recentPatients: Patient[];
  searchResults: Patient[];
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  
  // Actions
  fetchPatients: (page?: number, limit?: number) => Promise<void>;
  searchPatients: (query: string) => Promise<void>;
  selectPatient: (patientId: string) => Promise<void>;
  updatePatient: (patientId: string, updates: Partial<Patient>) => Promise<void>;
  createPatient: (patientData: Partial<Patient>) => Promise<Patient>;
  clearSearch: () => void;
  clearError: () => void;
  reset: () => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  patients: [],
  selectedPatient: null,
  recentPatients: [],
  searchResults: [],
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  hasMore: false,

  fetchPatients: async (page = 1, limit = 20) => {
    set({ loading: true, error: null });
    
    try {
      const response = await patientsAPI.getPatients(page, limit);
      
      set({
        patients: page === 1 ? response.data : [...get().patients, ...response.data],
        currentPage: response.page,
        totalPages: Math.ceil(response.total / response.pageSize),
        hasMore: response.hasMore,
        loading: false,
        recentPatients: page === 1 ? response.data.slice(0, 10) : get().recentPatients,
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error.message || 'Failed to fetch patients',
      });
    }
  },

  searchPatients: async (query) => {
    if (query.length < 2) {
      set({ searchResults: [] });
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      const results = await patientsAPI.searchPatients(query);
      set({
        searchResults: results,
        loading: false,
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error.message || 'Search failed',
        searchResults: [],
      });
    }
  },

  selectPatient: async (patientId) => {
    set({ loading: true, error: null });
    
    try {
      const patient = await patientsAPI.getPatientById(patientId);
      set({
        selectedPatient: patient,
        loading: false,
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error.message || 'Failed to load patient',
        selectedPatient: null,
      });
    }
  },

  updatePatient: async (patientId, updates) => {
    try {
      const updatedPatient = await patientsAPI.updatePatient(patientId, updates);
      
      set((state) => ({
        patients: state.patients.map(p =>
          p.id === patientId ? updatedPatient : p
        ),
        selectedPatient: state.selectedPatient?.id === patientId
          ? updatedPatient
          : state.selectedPatient,
      }));
      
      return updatedPatient;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update patient' });
      throw error;
    }
  },

  createPatient: async (patientData) => {
    try {
      const newPatient = await patientsAPI.createPatient(patientData);
      
      set((state) => ({
        patients: [newPatient, ...state.patients],
        recentPatients: [newPatient, ...state.recentPatients.slice(0, 9)],
      }));
      
      return newPatient;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create patient' });
      throw error;
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      patients: [],
      selectedPatient: null,
      recentPatients: [],
      searchResults: [],
      loading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      hasMore: false,
    });
  },
}));
