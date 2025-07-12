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
  const [organization, setOrganization] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    checkAuth();
  }, []);
  
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };
  
  const login = async (credentials) => {
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
        patient: '/patient/dashboard',
        admin: '/admin/dashboard',
        client_admin: '/organization/dashboard',
        nurse: '/nurse/dashboard',
        mod: '/mod/dashboard'
      }[user.role] || '/dashboard';
      
      navigate(redirectPath);
      return { success: true };
    } catch (error) {
      throw error.response?.data || error;
    }
  };
  
  const verify2FA = async (tempToken, code) => {
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
      throw error.response?.data || error;
    }
  };
  
  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setOrganization(null);
      navigate('/login');
    }
  };
  
  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/signup', userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
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
    login,
    verify2FA,
    logout,
    register,
    checkAuth,
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