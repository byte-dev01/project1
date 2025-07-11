// LoginPage.js - Four authentication options
import React, { useState, useEffect } from 'react';
import { post } from '../../utilities';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin', 'signup', 'social', 'demo'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleInputFocus = (e) => {
    e.target.parentNode.classList.add('focus');
  };

  const handleInputBlur = (e) => {
    if (e.target.value === '') {
      e.target.parentNode.classList.remove('focus');
    }
  };

  // Traditional JWT Login/Signup
  const handleJWTAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = activeTab === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      
      if (activeTab === 'signup' && formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        if (activeTab === 'signup') {
          setSuccess('Account created successfully! Please sign in.');
          setActiveTab('signin');
          setFormData({ ...formData, password: '', confirmPassword: '' });
        } else {
          // Successful login
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('authProvider', 'jwt');
          
          // Call the login handler
          onLogin({
            user: data,
            accessToken: data.accessToken
          });
        }
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Demo Login
  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const demoLoginResponse = {
        profileObj: { 
          name: "Demo User",
          email: "demo@example.com" 
        },
        tokenObj: { 
          id_token: "demo-token-12345" 
        }
      };
      
      const response = await post("/api/login", { token: "demo-token-12345" });
      onLogin(demoLoginResponse);
    } catch (error) {
      setError('Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Apple Sign In (placeholder - would need Apple Auth integration)
  const handleAppleSignIn = async () => {
    setError('Apple Sign In will be available soon!');
    // This would integrate with the Apple Auth code we discussed earlier
  };

  // Google Sign In (placeholder)
  const handleGoogleSignIn = async () => {
    setError('Google Sign In will be available soon!');
    // This would integrate with Google OAuth
  };

  const renderAuthTabs = () => (
    <div className="auth-tabs">
      <button 
        className={`tab-button ${activeTab === 'signin' ? 'active' : ''}`}
        onClick={() => setActiveTab('signin')}
      >
        Sign In
      </button>
      <button 
        className={`tab-button ${activeTab === 'signup' ? 'active' : ''}`}
        onClick={() => setActiveTab('signup')}
      >
        Sign Up
      </button>
      <button 
        className={`tab-button ${activeTab === 'social' ? 'active' : ''}`}
        onClick={() => setActiveTab('social')}
      >
        Social Login
      </button>
      <button 
        className={`tab-button ${activeTab === 'demo' ? 'active' : ''}`}
        onClick={() => setActiveTab('demo')}
      >
        Demo
      </button>
    </div>
  );

  const renderJWTForm = () => (
    <form onSubmit={handleJWTAuth} className="form">
      <h1 className="form__title">
        {activeTab === 'signup' ? 'Create Account' : 'Sign In'}
      </h1>

      {error && (
        <div className="form__error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {success && (
        <div className="form__success">
          <span className="success-icon">✅</span>
          {success}
        </div>
      )}

      {activeTab === 'signup' && (
        <div className="form__div">
          <input 
            type="text" 
            className="form__input" 
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder=" "
            required
          />
          <label className="form__label">Full Name</label>
        </div>
      )}

      <div className="form__div">
        <input 
          type="text" 
          className="form__input" 
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder=" "
          required
        />
        <label className="form__label">Username or Email</label>
      </div>

      {activeTab === 'signup' && (
        <div className="form__div">
          <input 
            type="email" 
            className="form__input" 
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder=" "
            required
          />
          <label className="form__label">Email Address</label>
        </div>
      )}

      <div className="form__div">
        <input 
          type="password" 
          className="form__input" 
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder=" "
          required
        />
        <label className="form__label">Password</label>
      </div>

      {activeTab === 'signup' && (
        <div className="form__div">
          <input 
            type="password" 
            className="form__input" 
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder=" "
            required
          />
          <label className="form__label">Confirm Password</label>
        </div>
      )}

      <button 
        type="submit" 
        className="form__button"
        disabled={isLoading}
      >
        {isLoading ? (
          <span>
            <span className="spinner"></span>
            {activeTab === 'signup' ? 'Creating Account...' : 'Signing In...'}
          </span>
        ) : (
          activeTab === 'signup' ? 'Create Account' : 'Sign In'
        )}
      </button>
    </form>
  );

  const renderSocialLogin = () => (
    <div className="form social-login">
      <h1 className="form__title">Social Login</h1>
      
      {error && (
        <div className="form__error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="social-buttons">
        <button 
          className="social-button apple-button"
          onClick={handleAppleSignIn}
          disabled={isLoading}
        >
          <span className="social-icon">🍎</span>
          Sign in with Apple
        </button>

        <button 
          className="social-button google-button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <span className="social-icon">📧</span>
          Sign in with Google
        </button>
      </div>

      <div className="social-divider">
        <span>Coming Soon</span>
      </div>

      <p className="social-description">
        Social login options will be available in the next update. 
        For now, please use the traditional login or demo access.
      </p>
    </div>
  );

  const renderDemoLogin = () => (
    <div className="form demo-login">
      <h1 className="form__title">Demo Access</h1>
      
      {error && (
        <div className="form__error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="demo-info">
        <div className="demo-icon">🎭</div>
        <h3>Try HealthBridge</h3>
        <p>Explore all features with sample data</p>
        
        <ul className="demo-features">
          <li>✅ Access patient dashboard</li>
          <li>✅ View medical records</li>
          <li>✅ Test fax processing</li>
          <li>✅ Try voice transcription</li>
          <li>✅ No registration required</li>
        </ul>
      </div>

      <button 
        className="form__button demo-button"
        onClick={handleDemoLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <span>
            <span className="spinner"></span>
            Starting Demo...
          </span>
        ) : (
          <>
            <span className="demo-icon-small">🎭</span>
            Start Demo Experience
          </>
        )}
      </button>

      <div className="demo-note">
        <p>
          <strong>Note:</strong> Demo data is reset periodically. 
          For persistent access, please create an account.
        </p>
      </div>
    </div>
  );

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <div className="l-form">
        <div className="login-container">
          <div className="login-header">
            <div className="logo-section">
              <div className="logo">🏥</div>
              <h2>HealthBridge</h2>
              <p>Secure Medical Records Management</p>
            </div>
          </div>

          {renderAuthTabs()}

          <div className="form-container">
            {activeTab === 'signin' || activeTab === 'signup' ? renderJWTForm() : null}
            {activeTab === 'social' ? renderSocialLogin() : null}
            {activeTab === 'demo' ? renderDemoLogin() : null}
          </div>

          <div className="login-footer">
            <div className="security-badge">
              <span className="security-icon">🔒</span>
              <span>HIPAA Compliant & Secure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;