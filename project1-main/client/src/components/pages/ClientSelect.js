// client/src/pages/ClinicSelect.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function ClinicSelect() {
  const [clinics, setClinics] = useState([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    // 获取所有活跃的诊所
    axios.get('/api/organizations/active')
      .then(res => setClinics(res.data))
      .catch(err => console.error(err));
  }, []);
  
  const selectClinic = (clinic) => {
    localStorage.setItem('selectedClinic', clinic.slug);
    navigate('/login');
  };
  
  return (
    <div className="clinic-select-page">
      <h1>选择您的诊所</h1>
      <div className="clinic-grid">
        {clinics.map(clinic => (
          <div 
            key={clinic._id} 
            className="clinic-card"
            onClick={() => selectClinic(clinic)}
          >
            <h3>{clinic.name}</h3>
            <p>{clinic.address.city}, {clinic.address.state}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ClinicSelect;