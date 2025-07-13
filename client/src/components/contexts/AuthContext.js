// client/src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { socket } from '../../client-socket';
import { get, post } from '../../utilities';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
    error: null
  });
  
  const history = useHistory();

  // Initialize axios interceptors
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          config.headers['x-access-token'] = token;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          await logout();
          history.push('/login');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [history]);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (token) {
        // Verify token with backend
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-access-token': token
          }
        });

        const data = await response.json();

        if (data.success && data.user) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            user: {
              id: data.user.id,
              username: data.user.username,
              email: data.user.email,
              name: data.user.name,
              roles: data.user.roles || [],
              clinicId: data.user.clinicId,
              clinicName: data.user.clinicName
            },
            token: token,
            error: null
          });

          // Initialize socket
         // await post("/api/initsocket", { socketid: socket.id });
        } else {
          // Token invalid
          clearAuth();
        }
      } else {
        // No token, check session
        const user = await get("/api/whoami");
        
        if (user._id) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              name: user.name || user.username || "User",
              roles: user.roles || [],
              clinicId: user.clinicId,
              clinicName: user.clinicName
            },
            token: null,
            error: null
          });
          
          //await post("/api/initsocket", { socketid: socket.id });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      clearAuth();
    }
  }, []);

  const login = useCallback(async (credentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        // Store token
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
        }

        // Update state
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: data.id,
            username: data.username,
            email: data.email,
            name: data.name,
            roles: data.roles || [],
            clinicId: data.clinicId,
            clinicName: data.clinicName
          },
          token: data.accessToken,
          error: null
        });

        // Initialize socket
        //await post("/api/initsocket", { socketid: socket.id });

        // Redirect based on role
        const redirectPath = getRedirectPath(data.roles);
        history.push(redirectPath);

        return { success: true };
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Login failed'
        }));
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error("Login error:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Network error'
      }));
      return { success: false, error: error.message };
    }
  }, [history]);

  const logout = useCallback(async () => {
    try {
      await post("/api/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    clearAuth();
    history.push('/login');
  }, [history]);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('accessToken');
    
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      error: null
    });
  }, []);

  const updateUser = useCallback((updates) => {
    setState(prev => ({
      ...prev,
      user: { ...prev.user, ...updates }
    }));
  }, []);

  const hasRole = useCallback((role) => {
    return state.user?.roles?.some(r => 
      r.toLowerCase() === role.toLowerCase() || 
      r === `ROLE_${role.toUpperCase()}`
    );
  }, [state.user]);

  const hasAnyRole = useCallback((roles) => {
    return roles.some(role => hasRole(role));
  }, [hasRole]);

  const getRedirectPath = (roles) => {
    if (roles.includes('ROLE_ADMIN')) return '/admin/dashboard';
    if (roles.includes('ROLE_DOCTOR')) return '/doctor/dashboard';
    if (roles.includes('ROLE_PATIENT')) return '/patient/dashboard';
    return '/dashboard';
  };

  const value = {
    ...state,
    login,
    logout,
    checkAuth,
    updateUser,
    hasRole,
    hasAnyRole,
    clearError: () => setState(prev => ({ ...prev, error: null }))
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// HOC for protected routes
export const withAuth = (Component) => {
  return (props) => {
    const { isAuthenticated, isLoading } = useAuth();
    const history = useHistory();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        history.push('/login');
      }
    }, [isAuthenticated, isLoading, history]);

    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }

    return isAuthenticated ? <Component {...props} /> : null;
  };
};

// Protected Route Component
export const ProtectedRoute = ({ component: Component, roles, ...rest }) => {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const hasRequiredRole = !roles || roles.length === 0 || hasAnyRole(roles);

  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? (
          hasRequiredRole ? (
            <Component {...props} />
          ) : (
            <Redirect to="/unauthorized" />
          )
        ) : (
          <Redirect to="/login" />
        )
      }
    />
  );
};