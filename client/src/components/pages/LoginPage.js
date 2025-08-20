// pages/LoginPage.js
// pages/LoginPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { post } from '../../utilities';
import './Login.css';

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
  
  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Add cleanup for useEffect
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
            { _id: '1', name: 'Downtown Medical Clinic', address: 'Main campus - Comprehensive care' },
            { _id: '2', name: 'Westside Health Center', address: 'West branch - Specialty clinics' },
            { _id: '3', name: 'Eastside Clinic', address: 'East location - Community care' },
            { _id: '4', name: 'Community Hospital', address: 'Emergency services 24/7' }
          ]);
        }
      }
    };
    
    fetchClinics();
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper function to format address
  const formatAddress = (address) => {
    if (typeof address === 'string') {
      return address;
    }
    if (typeof address === 'object' && address !== null) {
      // If address is an object, format it properly
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
      // Call your auth endpoint
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
          console.log('Signin response:', data);

          if (data.success) {
            // Your existing success logic
          } else {
            setError(data.message || 'Login failed');
          }
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

// In your LoginPage.js handleSubmit function, fix this:

      // In your LoginPage.js handleSubmit function, replace the success block with this:

      if (data.success) {
        // 🔍 DEBUG: Let's see exactly what we received
        console.log('🔍 Full signin response data:', data);
        console.log('🔍 data.accessToken:', data.accessToken);
        console.log('🔍 data.roles:', data.roles);
        console.log('🔍 data.user:', data.user);
        console.log('🔍 data.id:', data.id);
        console.log('🔍 data.username:', data.username);

        // ✅ Store token (with fallback)
        const token = data.accessToken || data.token;
        if (token && token !== 'undefined') {
          localStorage.setItem('accessToken', token);
          console.log('✅ Stored token:', token);
        } else {
          console.error('❌ No valid token found in response');
        }

        // ✅ Store roles (with fallback)
        const roles = data.roles || data.user?.roles || [];
        if (roles && Array.isArray(roles)) {
          localStorage.setItem('userRoles', JSON.stringify(roles));
          console.log('✅ Stored roles:', roles);
        } else {
          console.error('❌ No valid roles found in response');
          localStorage.setItem('userRoles', JSON.stringify([]));
        }

        // ✅ Store user data (multiple fallback options)
        let userData = {};
        
        if (data.user && typeof data.user === 'object') {
          // If there's a separate user object
          userData = data.user;
        } else {
          // If user data is at the top level
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
        console.log('✅ Stored user data:', userData);
        
        // ✅ Find selected clinic info
        const selectedClinic = clinics.find(c => c._id === formData.clinicId);
        
        // ✅ Call parent's login handler
        onLogin({
          user: userData,  // Use the processed user data
          clinic: selectedClinic
        });
        
        // ✅ Redirect to dashboard
        console.log("🎯 Redirecting to dashboard");
        history.push('/dashboard');

      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      // Check if component is still mounted before updating state
      if (isMountedRef.current) {
        setError('Login failed. Please check your credentials.');
        console.error('Login error:', error);
      }
    } finally {
      // Check if component is still mounted before updating state
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>HealthBridge</h1>
          <p>Secure Medical Records System</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Clinic Selection */}
          <div className="form-group">
            <label htmlFor="clinicId">Select Your Clinic</label>
            <select
              id="clinicId"
              name="clinicId"
              value={formData.clinicId}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="">-- Choose a clinic --</option>
              {clinics.map(clinic => (
                <option key={clinic._id} value={clinic._id}>
                  {clinic.name} {formatAddress(clinic.address) && `- ${formatAddress(clinic.address)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Username */}
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="form-control"
              placeholder="Enter your username or email"
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="form-control"
              placeholder="Enter your password"
              required
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="login-footer">
            <a href="/forgot-password">Forgot Password?</a>
            <span className="separator">•</span>
            <a href="/register">Create Account</a>
          </div>
        </form>

        <div className="security-notice">
          <span>🔒 HIPAA Compliant • Encrypted • Secure</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;