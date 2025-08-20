// pages/Unauthorized.js
import React from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Unauthorized.css';

const Unauthorized = () => {
  const history = useHistory();
  const { user } = useAuth();

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <div className="unauthorized-icon">
          <svg className="icon-lock" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h1 className="unauthorized-title">Access Denied</h1>
        
        <p className="unauthorized-message">
          Sorry, you don't have permission to access this page.
        </p>
        
        {user && (
          <p className="unauthorized-details">
            You are logged in as <strong>{user.name}</strong> with role: <strong>{user.roles.join(', ')}</strong>
          </p>
        )}
        
        <div className="unauthorized-actions">
          <button 
            onClick={() => history.goBack()} 
            className="btn-secondary"
          >
            Go Back
          </button>
          
          <button 
            onClick={() => history.push('/dashboard')} 
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
        
        <p className="unauthorized-help">
          If you believe you should have access to this page, please contact your administrator.
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;