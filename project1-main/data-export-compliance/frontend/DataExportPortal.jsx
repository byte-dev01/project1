import React, { useState, useEffect } from 'react';
import { 
  Download, FileText, Shield, Clock, CheckCircle, 
  XCircle, AlertTriangle, Lock, Calendar, User
} from 'lucide-react';
import './DataExportPortal.css';

const DataExportPortal = () => {
  const [activeTab, setActiveTab] = useState('request');
  const [exportRequests, setExportRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verificationModal, setVerificationModal] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  
  const [requestForm, setRequestForm] = useState({
    patientId: '',
    dataCategories: [],
    dateRange: {
      startDate: '',
      endDate: ''
    },
    format: 'pdf',
    deliveryMethod: 'download',
    purpose: 'personal_use',
    verificationMethod: 'email',
    gdprConsent: false,
    hipaaAuthorization: false
  });

  const [verificationCode, setVerificationCode] = useState('');

  const dataCategories = [
    { id: 'medical_records', label: 'Medical Records', icon: FileText },
    { id: 'lab_results', label: 'Laboratory Results', icon: FileText },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
    { id: 'imaging', label: 'Imaging Studies', icon: FileText },
    { id: 'visit_notes', label: 'Visit Notes', icon: FileText },
    { id: 'insurance_claims', label: 'Insurance Claims', icon: FileText },
    { id: 'billing', label: 'Billing Information', icon: FileText },
    { id: 'allergies', label: 'Allergies', icon: AlertTriangle },
    { id: 'immunizations', label: 'Immunizations', icon: Shield },
    { id: 'procedures', label: 'Procedures', icon: FileText },
    { id: 'demographics', label: 'Demographics', icon: User },
    { id: 'emergency_contacts', label: 'Emergency Contacts', icon: User }
  ];

  const exportFormats = [
    { value: 'pdf', label: 'PDF Document', description: 'Human-readable format' },
    { value: 'json', label: 'JSON', description: 'Machine-readable format' },
    { value: 'xml', label: 'XML', description: 'Structured data format' },
    { value: 'fhir', label: 'FHIR', description: 'Healthcare standard format' },
    { value: 'ccd', label: 'CCD', description: 'Continuity of Care Document' }
  ];

  const purposes = [
    { value: 'personal_use', label: 'Personal Use' },
    { value: 'second_opinion', label: 'Second Opinion' },
    { value: 'changing_provider', label: 'Changing Healthcare Provider' },
    { value: 'insurance_claim', label: 'Insurance Claim' },
    { value: 'legal_requirement', label: 'Legal Requirement' },
    { value: 'research', label: 'Research Participation' },
    { value: 'continuity_of_care', label: 'Continuity of Care' }
  ];

  useEffect(() => {
    fetchExportRequests();
  }, []);

  const fetchExportRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/export/requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setExportRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch export requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (categoryId) => {
    setRequestForm(prev => ({
      ...prev,
      dataCategories: prev.dataCategories.includes(categoryId)
        ? prev.dataCategories.filter(id => id !== categoryId)
        : [...prev.dataCategories, categoryId]
    }));
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    
    if (!requestForm.gdprConsent || !requestForm.hipaaAuthorization) {
      alert('Please provide required consents and authorizations');
      return;
    }

    if (requestForm.dataCategories.length === 0) {
      alert('Please select at least one data category');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/export/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestForm)
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentRequestId(data.requestId);
        setVerificationModal(true);
        fetchExportRequests();
      }
    } catch (error) {
      console.error('Failed to submit export request:', error);
      alert('Failed to submit export request');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!verificationCode) {
      alert('Please enter verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/export/verify/${currentRequestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ verificationCode })
      });

      const data = await response.json();
      
      if (data.success) {
        setVerificationModal(false);
        setVerificationCode('');
        alert('Verification successful! Your export is being processed.');
        fetchExportRequests();
      }
    } catch (error) {
      console.error('Verification failed:', error);
      alert('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (requestId, token) => {
    try {
      const response = await fetch(`/api/export/download/${requestId}/${token}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const encryptionKey = response.headers.get('X-Encryption-Key');
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient_export_${requestId}.enc`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      if (encryptionKey) {
        alert(`File downloaded. Decryption key: ${encryptionKey}\n\nPlease save this key securely.`);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download export');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon completed" />;
      case 'processing':
        return <Clock className="status-icon processing" />;
      case 'rejected':
        return <XCircle className="status-icon rejected" />;
      case 'pending':
        return <Clock className="status-icon pending" />;
      default:
        return <AlertTriangle className="status-icon" />;
    }
  };

  return (
    <div className="data-export-portal">
      <div className="portal-header">
        <h1>Patient Data Export Portal</h1>
        <p>Request and manage your health information exports in compliance with HIPAA and GDPR</p>
      </div>

      <div className="portal-tabs">
        <button 
          className={`tab-button ${activeTab === 'request' ? 'active' : ''}`}
          onClick={() => setActiveTab('request')}
        >
          New Request
        </button>
        <button 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Request History
        </button>
        <button 
          className={`tab-button ${activeTab === 'rights' ? 'active' : ''}`}
          onClick={() => setActiveTab('rights')}
        >
          Your Rights
        </button>
      </div>

      {activeTab === 'request' && (
        <div className="request-form-container">
          <form onSubmit={handleSubmitRequest} className="export-request-form">
            <div className="form-section">
              <h3>Select Data Categories</h3>
              <div className="category-grid">
                {dataCategories.map(category => (
                  <div 
                    key={category.id}
                    className={`category-card ${requestForm.dataCategories.includes(category.id) ? 'selected' : ''}`}
                    onClick={() => handleCategoryToggle(category.id)}
                  >
                    <category.icon size={24} />
                    <span>{category.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3>Date Range</h3>
              <div className="date-range">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={requestForm.dateRange.startDate}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, startDate: e.target.value }
                    }))}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={requestForm.dateRange.endDate}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, endDate: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Export Format</h3>
              <div className="format-options">
                {exportFormats.map(format => (
                  <label key={format.value} className="format-option">
                    <input
                      type="radio"
                      name="format"
                      value={format.value}
                      checked={requestForm.format === format.value}
                      onChange={(e) => setRequestForm(prev => ({
                        ...prev,
                        format: e.target.value
                      }))}
                    />
                    <div>
                      <strong>{format.label}</strong>
                      <p>{format.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3>Purpose of Export</h3>
              <select
                value={requestForm.purpose}
                onChange={(e) => setRequestForm(prev => ({
                  ...prev,
                  purpose: e.target.value
                }))}
                className="purpose-select"
              >
                {purposes.map(purpose => (
                  <option key={purpose.value} value={purpose.value}>
                    {purpose.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-section">
              <h3>Verification Method</h3>
              <div className="verification-options">
                <label>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="email"
                    checked={requestForm.verificationMethod === 'email'}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      verificationMethod: e.target.value
                    }))}
                  />
                  Email Verification
                </label>
                <label>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="sms"
                    checked={requestForm.verificationMethod === 'sms'}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      verificationMethod: e.target.value
                    }))}
                  />
                  SMS Verification
                </label>
              </div>
            </div>

            <div className="form-section consent-section">
              <h3>Required Consents</h3>
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={requestForm.gdprConsent}
                  onChange={(e) => setRequestForm(prev => ({
                    ...prev,
                    gdprConsent: e.target.checked
                  }))}
                />
                <span>
                  I consent to the processing of my personal data in accordance with GDPR regulations
                </span>
              </label>
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={requestForm.hipaaAuthorization}
                  onChange={(e) => setRequestForm(prev => ({
                    ...prev,
                    hipaaAuthorization: e.target.checked
                  }))}
                />
                <span>
                  I authorize the release of my protected health information as per HIPAA guidelines
                </span>
              </label>
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Processing...' : 'Submit Export Request'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="request-history">
          {loading ? (
            <div className="loading">Loading export requests...</div>
          ) : exportRequests.length === 0 ? (
            <div className="no-requests">
              <FileText size={48} />
              <p>No export requests found</p>
            </div>
          ) : (
            <div className="request-list">
              {exportRequests.map(request => (
                <div key={request.requestId} className="request-card">
                  <div className="request-header">
                    {getStatusIcon(request.status)}
                    <div className="request-info">
                      <h4>Request #{request.requestId.slice(0, 8)}</h4>
                      <p className="request-date">
                        <Calendar size={14} />
                        {new Date(request.requestDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="request-details">
                    <div className="detail-item">
                      <span className="detail-label">Status:</span>
                      <span className={`status ${request.status}`}>{request.status}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Format:</span>
                      <span>{request.format.toUpperCase()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Categories:</span>
                      <span>{request.dataCategories.length} selected</span>
                    </div>
                  </div>

                  {request.status === 'completed' && request.exportDetails && (
                    <div className="download-section">
                      <p className="expiry-notice">
                        <AlertTriangle size={14} />
                        Expires: {new Date(request.exportDetails.downloadExpiry).toLocaleDateString()}
                      </p>
                      <button 
                        className="download-button"
                        onClick={() => handleDownload(request.requestId, request.downloadToken)}
                      >
                        <Download size={16} />
                        Download Export
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rights' && (
        <div className="rights-information">
          <div className="rights-card">
            <Shield size={32} className="rights-icon" />
            <h3>Your Data Rights Under HIPAA</h3>
            <ul>
              <li>Right to access your health records</li>
              <li>Right to request amendments to your records</li>
              <li>Right to receive an accounting of disclosures</li>
              <li>Right to request restrictions on uses and disclosures</li>
              <li>Right to choose how we communicate with you</li>
              <li>Right to file a complaint</li>
            </ul>
          </div>

          <div className="rights-card">
            <Lock size={32} className="rights-icon" />
            <h3>Your Data Rights Under GDPR</h3>
            <ul>
              <li>Right to be informed about data processing</li>
              <li>Right of access to your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Rights related to automated decision making</li>
            </ul>
          </div>

          <div className="rights-card">
            <FileText size={32} className="rights-icon" />
            <h3>Export Information</h3>
            <p>
              Your exported data will be encrypted and available for download for 7 days. 
              You can download your export up to 3 times. The export will include all 
              requested categories of health information in your chosen format.
            </p>
            <p>
              For security, you will receive a decryption key separately. Please store 
              this key securely as it is required to access your exported data.
            </p>
          </div>
        </div>
      )}

      {verificationModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Verify Your Request</h3>
            <p>Please enter the verification code sent to your registered {requestForm.verificationMethod}</p>
            <input
              type="text"
              placeholder="Enter verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="verification-input"
            />
            <div className="modal-buttons">
              <button onClick={handleVerification} className="verify-button" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button onClick={() => setVerificationModal(false)} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataExportPortal;