import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const history = useHistory();
  const { login, isLoading: authLoading, error: authError, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    clinicId: ''
  });
  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Cleanup function
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear auth errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Fetch clinics on mount
  useEffect(() => {
    let abortController = new AbortController();
    
    const fetchClinics = async () => {
      try {
        const response = await fetch('/api/clinics', {
          signal: abortController.signal
        });
        const data = await response.json();
        
        if (isMountedRef.current && !abortController.signal.aborted) {
          // Process clinics to ensure address is always a string
          const processedClinics = data.map(clinic => ({
            ...clinic,
            address: formatAddress(clinic.address) // Convert address to string immediately
          }));
          setClinics(processedClinics);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch clinics:', error);
          // Fallback clinics if API fails
          if (isMountedRef.current) {
            setClinics([
              { _id: '1', name: 'Downtown Medical Clinic', address: 'Main campus - Comprehensive care', isDemo: true },
              { _id: '2', name: 'Westside Health Center', address: 'West branch - Specialty clinics', isDemo: true },
              { _id: '3', name: 'Eastside Clinic', address: 'East location - Community care', isDemo: true },
              { _id: '4', name: 'Community Hospital', address: 'Emergency services 24/7', isDemo: false }
            ]);
          }
        }
      }
    };
    
    fetchClinics();
    
    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, []);

  // Helper function to format address - fixed to always return a string
  const formatAddress = (address) => {
    if (!address) return '';
    
    if (typeof address === 'string') {
      return address;
    }
    
    if (typeof address === 'object' && address !== null) {
      const { street, city, state, zip } = address;
      const parts = [];
      if (street) parts.push(street);
      if (city) parts.push(city);
      if (state) parts.push(state);
      if (zip) parts.push(zip);
      return parts.join(', ');
    }
    
    return '';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user types
    if (authError) {
      clearError(); // Clear auth context error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear any existing errors
    setError('');
    clearError();

    // Validation
    if (!formData.clinicId) {
      setError('Please select a clinic');
      return;
    }

    if (!formData.username || !formData.password) {
      setError('Please enter username and password');
      return;
    }

    setIsLoading(true);

    try {
      // Use the auth context's login method
      const result = await login({
        username: formData.username,
        password: formData.password,
        clinicId: formData.clinicId,
        rememberMe: rememberMe
      });

      if (!result.success) {
        setError(result.error || 'Login failed');
        setIsLoading(false);
      }
      // If successful, the auth context will handle the redirect
      
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  // Combine local and auth errors
  const displayError = error || authError;
  const loading = isLoading || authLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="bg-red-700 text-white font-bold text-2xl px-3 py-1 rounded">IU</span>
              <span className="ml-2 text-gray-900 font-semibold text-xl">Health</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Login Box */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Sign In</h1>
                <p className="mt-2 text-gray-600">Access your IU Health account</p>
              </div>

              {displayError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
                  <span className="mr-2">⚠️</span>
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Clinic Selection */}
                <div>
                  <label htmlFor="clinicId" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Your Clinic
                  </label>
                  <select
                    id="clinicId"
                    name="clinicId"
                    value={formData.clinicId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                    disabled={loading}
                  >
                    <option value="">-- Choose a clinic --</option>
                    {clinics.some(c => c.isDemo) && clinics.some(c => !c.isDemo) ? (
                      <>
                        <optgroup label="Demo Clinics">
                          {clinics.filter(c => c.isDemo).map(clinic => (
                            <option key={clinic._id} value={clinic._id}>
                              {clinic.name} {clinic.address && `- ${clinic.address}`}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Live Clinics">
                          {clinics.filter(c => !c.isDemo).map(clinic => (
                            <option key={clinic._id} value={clinic._id}>
                              {clinic.name} {clinic.address && `- ${clinic.address}`}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      clinics.map(clinic => (
                        <option key={clinic._id} value={clinic._id}>
                          {clinic.name} {clinic.address && `- ${clinic.address}`}
                        </option>
                      ))
                    )}
                  </select>
                  {clinics.some(c => c.isDemo) && (
                    <p className="mt-1 text-xs text-gray-500">
                      For demo, select any clinic from the Demo Clinics section
                    </p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter your username or email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                    disabled={!formData.clinicId || loading}
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 pr-10"
                      disabled={!formData.clinicId || loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      disabled={!formData.clinicId || loading}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      disabled={!formData.clinicId || loading}
                    />
                    <span className="ml-2 text-sm text-gray-700">Remember me</span>
                  </label>
                  <a href="/forgot-password" className="text-sm text-red-700 hover:text-red-800 hover:underline">
                    Forgot password?
                  </a>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !formData.clinicId}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors duration-200 ${
                    loading || !formData.clinicId
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-700 text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600'
                  }`}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Demo Credentials Info */}
              {formData.clinicId && clinics.find(c => c._id === formData.clinicId)?.isDemo && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700 font-medium">Demo Mode</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Use any username/password for demo access
                  </p>
                </div>
              )}

              <div className="mt-6">
                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <a href="/register" className="text-red-700 hover:text-red-800 hover:underline font-medium">
                    Register here
                  </a>
                </p>
                
                <div className="mt-4 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>

                <button 
                  type="button"
                  className="mt-4 w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-colors duration-200 font-medium"
                  disabled={loading}
                >
                  Sign in with MyChart
                </button>
              </div>

              <div className="mt-6 text-center">
                <span className="text-xs text-gray-500">🔒 HIPAA Compliant • Encrypted • Secure</span>
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-red-50 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to IU Health</h2>
              <p className="text-gray-700 mb-6">Indiana's most comprehensive healthcare system</p>
              
              {formData.clinicId && (
                <div className="mb-6 p-4 bg-white rounded-md border border-red-100">
                  <h3 className="font-semibold text-gray-900 mb-1">Selected Clinic</h3>
                  <p className="text-sm text-gray-700">
                    {clinics.find(c => c._id === formData.clinicId)?.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {clinics.find(c => c._id === formData.clinicId)?.address || ''}
                  </p>
                </div>
              )}
              
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">Access your medical records</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">Schedule appointments</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">Message your care team</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">View test results</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">Manage prescriptions</span>
                </li>
              </ul>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Need help?</strong> Call our support line at{' '}
                  <a href="tel:1-800-555-0123" className="font-medium underline">
                    1-800-555-0123
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm">© 2024 Indiana University Health. All rights reserved.</p>
            <div className="mt-2 space-x-4 text-sm">
              <a href="#" className="hover:underline">Privacy Policy</a>
              <span>|</span>
              <a href="#" className="hover:underline">Terms of Use</a>
              <span>|</span>
              <a href="#" className="hover:underline">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;


/*
import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import './LoginPage3.css';

const LoginPage = ({ onLogin }) => {
  const history = useHistory();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    clinicId: ''
  });
  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Cleanup function
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch clinics on mount
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const response = await fetch('/api/clinics');
        const data = await response.json();
        
        if (isMountedRef.current) {
          setClinics(data);
        }
      } catch (error) {
        console.error('Failed to fetch clinics:', error);
        // Fallback clinics if API fails
        if (isMountedRef.current) {
          setClinics([
            { _id: '1', name: 'Downtown Medical Clinic', address: 'Main campus - Comprehensive care', isDemo: true },
            { _id: '2', name: 'Westside Health Center', address: 'West branch - Specialty clinics', isDemo: true },
            { _id: '3', name: 'Eastside Clinic', address: 'East location - Community care', isDemo: true },
            { _id: '4', name: 'Community Hospital', address: 'Emergency services 24/7', isDemo: true }
          ]);
        }
      }
    };
    
    fetchClinics();
  }, []);

  // Helper function to format address
  const formatAddress = (address) => {
    if (typeof address === 'string') {
      return address;
    }
    if (typeof address === 'object' && address !== null) {
      const { street, city, state, zip } = address;
      const parts = [];
      if (street) parts.push(street);
      if (city) parts.push(city);
      if (state) parts.push(state);
      if (zip) parts.push(zip);
      return parts.join(', ');
    }
    return '';
  };

  // Set up 24-hour timeout functionality
  const setupSessionTimeout = (token) => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Store login timestamp
    const loginTime = Date.now();
    localStorage.setItem('loginTime', loginTime.toString());
    
    // Set up timeout timer
    const timeoutId = setTimeout(() => {
      handleSessionExpiry();
    }, TWENTY_FOUR_HOURS);
    
    // Store timeout ID to clear if user logs out manually
    localStorage.setItem('sessionTimeoutId', timeoutId.toString());
    
    return timeoutId;
  };

  // Check if session is expired
  const checkSessionExpiry = () => {
    const loginTime = localStorage.getItem('loginTime');
    if (!loginTime) return true;
    
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const currentTime = Date.now();
    const sessionAge = currentTime - parseInt(loginTime);
    
    return sessionAge > TWENTY_FOUR_HOURS;
  };

  // Handle session expiry
  const handleSessionExpiry = () => {
    console.log('🕒 Session expired - logging out');
    
    // Clear all session data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userRoles');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('sessionTimeoutId');
    
    // Show expiry message
    setError('Your session has expired. Please log in again.');
    
    // Redirect to login
    if (history) {
      history.push('/login');
    }
  };

  // Check for existing expired session on component mount
  useEffect(() => {
    if (checkSessionExpiry()) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        handleSessionExpiry();
      }
    }
  }, []);

  const handleInputChange = (e) => {
    if (!isMountedRef.current) return;
    
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setError('');

    // Validation
    if (!formData.clinicId) {
      if (isMountedRef.current) {
        setError('Please select a clinic');
        setIsLoading(false);
      }
      return;
    }

    if (!formData.username || !formData.password) {
      if (isMountedRef.current) {
        setError('Please enter username and password');
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          clinicId: formData.clinicId
        })
      });

      const data = await response.json();
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      if (data.success) {
        console.log('✅ Login successful:', data);

        // Store token (with fallback)
        const token = data.accessToken || data.token;
        if (token && token !== 'undefined') {
          localStorage.setItem('accessToken', token);
          
          // Set up 24-hour timeout
          setupSessionTimeout(token);
          
          console.log('✅ Stored token with 24-hour timeout');
        } else {
          console.error('❌ No valid token found in response');
        }

        // Store roles (with fallback)
        const roles = data.roles || data.user?.roles || [];
        if (roles && Array.isArray(roles)) {
          localStorage.setItem('userRoles', JSON.stringify(roles));
        } else {
          localStorage.setItem('userRoles', JSON.stringify([]));
        }

        // Store user data (multiple fallback options)
        let userData = {};
        
        if (data.user && typeof data.user === 'object') {
          userData = data.user;
        } else {
          userData = {
            id: data.id,
            username: data.username,
            email: data.email,
            name: data.name,
            clinicId: data.clinicId,
            clinicName: data.clinicName,
            roles: data.roles
          };
        }
        
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Find selected clinic info
        const selectedClinic = clinics.find(c => c._id === formData.clinicId);
        
        // Call parent's login handler
        if (onLogin) {
          onLogin({
            user: userData,
            clinic: selectedClinic
          });
        }
        
        // Redirect to dashboard
        console.log("🎯 Redirecting to dashboard");
        history.push('/dashboard');

      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError('Login failed. Please check your credentials.');
        console.error('Login error:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  */