// api/endpoints.ts

export const API_ENDPOINTS = {
  // 认证
  AUTH: {
    LOGIN: '/api/auth/signin',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    WHOAMI: '/api/whoami',
  },
  
  // 诊所
  CLINICS: {
    LIST: '/api/clinics',
    DETAIL: (id: string) => `/api/clinics/${id}`,
  },
  
  // 患者
  PATIENTS: {
    LIST: '/api/patients',
    SEARCH: '/api/patients/search',
    DETAIL: (id: string) => `/api/patients/${id}`,
    CREATE: '/api/patients',
    UPDATE: (id: string) => `/api/patients/${id}`,
  },
  
  // Fax
  FAX: {
    LIST: '/api/fax-records',
    STATS: '/api/fax-stats',
    DETAIL: (id: string) => `/api/fax/${id}`,
    UPDATE_STATUS: (id: string) => `/api/fax/${id}/status`,
  },
  
  // 保险
  INSURANCE: {
    PREFILL: '/api/insurance/prefill',
    VERIFY: '/api/insurance/verify',
    SUBMIT: '/api/insurance/submit',
  },
  
  // 消息
  MESSAGES: {
    LIST: '/api/messages',
    SEND: '/api/messages/send',
    DETAIL: (id: string) => `/api/messages/${id}`,
    MARK_READ: (id: string) => `/api/messages/${id}/read`,
  },
  
  // OCR
  OCR: {
    UPLOAD: '/api/ocr/upload',
    STATUS: (id: string) => `/api/ocr/status/${id}`,
  },
};

