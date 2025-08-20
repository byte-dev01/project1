// hooks/useAuth.js
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext({});

// Axios拦截器配置
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/auth/refresh', { refreshToken });
        const { accessToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh失败，跳转到登录
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false); // ✅ Added authLoading
  const [authError, setAuthError] = useState(null); // ✅ Added authError
  const [organization, setOrganization] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  // ✅ Added clearError function
  const clearError = () => {
    setAuthError(null);
  };
  
  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }
      
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
      setOrganization(response.data.organization);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAuthError('Session expired. Please log in again.');
    } finally {
      setLoading(false);
    }
  };
  
  const login = async (credentials) => {
    setAuthError(null); // ✅ Clear previous errors
    
    try {
      // 添加诊所选择
      const clinicSlug = localStorage.getItem('selectedClinic');
  
      const response = await axios.post('/api/auth/signin', {
        ...credentials,
        clinicSlug  // 发送诊所信息
      });

      const { user, accessToken, refreshToken, requires2FA, tempToken } = response.data;
      
      if (requires2FA) {
        return { requires2FA: true, tempToken };
      }
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);
      setOrganization(user.organization);
      
      // 根据角色重定向
      const redirectPath = {
        doctor: '/doctor/dashboard',
        admin: '/admin/dashboard',
        client_admin: '/organization/dashboard',
        staff: '/staff/dashboard',
        mod: '/mod/dashboard'
      }[user.role] || '/dashboard';
      
      navigate(redirectPath);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      setAuthError(errorMessage); // ✅ Set error state
      return { success: false, error: errorMessage };
    } finally {
      setAuthLoading(false); // ✅ Clear loading state
    }
  };
  
  const verify2FA = async (tempToken, code) => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const response = await axios.post('/api/auth/verify-2fa', { tempToken, code });
      const { user, accessToken, refreshToken } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);
      setOrganization(user.organization);
      
      const redirectPath = {
        doctor: '/doctor/dashboard',
        patient: '/patient/dashboard',
        admin: '/admin/dashboard',
        client_admin: '/organization/dashboard',
        nurse: '/nurse/dashboard'
      }[user.role] || '/dashboard';
      
      navigate(redirectPath);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '2FA verification failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setAuthLoading(false);
    }
  };
  
  const logout = async () => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setOrganization(null);
      setAuthLoading(false);
      navigate('/login');
    }
  };
  
  const register = async (userData) => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const response = await axios.post('/api/auth/signup', userData);
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setAuthLoading(false);
    }
  };
  
  const hasRole = (role) => {
    return user?.role === role;
  };
  
  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission) || false;
  };
  
  const belongsToOrganization = (orgId) => {
    return user?.organizationId === orgId || user?.role === 'admin';
  };
  
  const value = {
    user,
    organization,
    loading,
    authLoading, // ✅ Added authLoading
    authError,   // ✅ Added authError
    login,
    verify2FA,
    logout,
    register,
    checkAuth,
    clearError,  // ✅ Added clearError
    hasRole,
    hasPermission,
    belongsToOrganization
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};