// pages/Login.js
import React, { useState, useEffect } from 'react';
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

  // Fetch available clinics on component mount
  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const response = await fetch('/api/clinics');
      const data = await response.json();
      setClinics(data);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
      // Fallback clinics if API fails
      setClinics([
        { _id: '1', name: 'Downtown Medical Clinic', address: 'Main campus - Comprehensive care' },
        { _id: '2', name: 'Westside Health Center', address: 'West branch - Specialty clinics' },
        { _id: '3', name: 'Eastside Clinic', address: 'East location - Community care' },
        { _id: '4', name: 'Community Hospital', address: 'Emergency services 24/7' }
      ]);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validation
    if (!formData.clinicId) {
      setError('Please select a clinic');
      setIsLoading(false);
      return;
    }

    if (!formData.username || !formData.password) {
      setError('Please enter username and password');
      setIsLoading(false);
      return;
    }

    try {
      // Call your auth endpoint
      const response = await post('/api/auth/signin', {
        username: formData.username,
        password: formData.password,
        clinicId: formData.clinicId
      });

      if (response.success) {
        // Store token
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('userRoles', JSON.stringify(response.roles));
        
        // Find selected clinic info
        const selectedClinic = clinics.find(c => c._id === formData.clinicId);
        
        // Call parent's login handler
        onLogin({
          user: response,
          clinic: selectedClinic
        });
        
        // Redirect to dashboard
        history.push('/');
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (error) {
      setError('Login failed. Please check your credentials.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
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
              required
            >
              <option value="">-- Choose a clinic --</option>
              {clinics.map(clinic => (
                <option key={clinic._id} value={clinic._id}>
                  {clinic.name} - {clinic.address}
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