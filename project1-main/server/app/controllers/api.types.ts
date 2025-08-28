export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface AuthRequest {
  username: string;
  password: string;
  clinicId: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface FaxStatsResponse {
  stats: {
    totalProcessed: number;
    todayProcessed: number;
    highSeverityCount: number;
    averageProcessingTime: number;
    systemStatus: 'Running' | 'Stopped' | 'Error';
  };
}
