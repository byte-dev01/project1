import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [clinics, setClinics] = useState([]);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();
    const [formData, setFormData] = useState({
      username: '',
      password: '',
      clinicId: ''
    });
    const { 
  login, 
  loading: authLoading, 
  authError,              // ✅ Add this
  clearError              // ✅ Add this
} = useAuth();

    // Use ref to track if component is mounted
    const isMountedRef = useRef(true);
  
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
      
      if (!isMountedRef.current) return;
      
      setIsLoading(true);
      setError('');
      clearError();

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

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
                  <span className="mr-2">⚠</span>
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Clinic Selection */}
                <div>
                  <label htmlFor="clinic" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Your Clinic
                  </label>
                  <select
                    id="clinic"
                    name = 'clinicId'
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
                    name = "username"
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
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
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
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* All your form fields here */}
                  
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !formData.clinicId}
                    className={`w-full py-3 px-4 rounded-md font-medium transition-colors duration-200 ${
                      isLoading || !formData.clinicId
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-700 text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600'
                    }`}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
</form>
              </div>

              {/* Demo Credentials Info */}
              {formData.clinicId && clinics.find(c => c.id === formData.clinicId)?.isDemo && (
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
                  <a href="#" className="text-red-700 hover:text-red-800 hover:underline font-medium">
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

                <button className="mt-4 w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-colors duration-200 font-medium">
                  Sign in with MyChart
                </button>
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
                    {clinics.find(c => c.id === formData.clinicId)?.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {clinics.find(c => c.id === formData.clinicId)?.address}
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



