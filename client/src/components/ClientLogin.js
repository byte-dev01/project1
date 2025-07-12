import React, { useState } from 'react';
import './ClinicLogin.css';

function ClinicLogin({ onSelectClinic }) {
  const [selectedClinic, setSelectedClinic] = useState('');
  
  // 预定义的诊所列表（实际项目中应该从API获取）
  const clinics = [
    { id: 'downtown-clinic', name: 'Downtown Medical Clinic', address: '123 Main St, Los Angeles, CA' },
    { id: 'westside-health', name: 'Westside Health Center', address: '456 Ocean Ave, Santa Monica, CA' },
    { id: 'eastside-clinic', name: 'Eastside Clinic', address: '789 Eastern Blvd, Pasadena, CA' },
    { id: 'community-hospital', name: 'Community Hospital', address: '321 Community Dr, Long Beach, CA' },
  ];
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClinic) {
      onSelectClinic(selectedClinic);
    }
  };
  
  return (
    <div className="clinic-login-container">
      <div className="clinic-login-box">
        <h1>Welcome to HealthBridge</h1>
        <h2>Please select your clinic</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="clinic-list">
            {clinics.map(clinic => (
              <label key={clinic.id} className="clinic-option">
                <input
                  type="radio"
                  name="clinic"
                  value={clinic.name}
                  checked={selectedClinic === clinic.name}
                  onChange={(e) => setSelectedClinic(e.target.value)}
                />
                <div className="clinic-info">
                  <h3>{clinic.name}</h3>
                  <p>{clinic.address}</p>
                </div>
              </label>
            ))}
          </div>
          
          <button 
            type="submit" 
            className="continue-button"
            disabled={!selectedClinic}
          >
            Continue to Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default ClinicLogin;
