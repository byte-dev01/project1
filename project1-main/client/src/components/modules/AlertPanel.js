import React, { Component } from "react";
import "./AlertPanel.css";

class AlertPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      phoneNumber: '',
      customMessage: '',
      showSendAlert: false,
      selectedAlertFax: null
    };
  }

  handleSendAlert = (fax) => {
    this.setState({
      showSendAlert: true,
      selectedAlertFax: fax,
      customMessage: `🚨 HIGH SEVERITY FAX ALERT\n\nFile: ${fax.fileName}\nSeverity: ${fax.severityLevel} (${fax.severityScore}/10)\nReason: ${fax.severityReason}\n\nImmediate review required.`
    });
  };

  submitAlert = () => {
    if (!this.state.phoneNumber.trim()) {
      alert('Please enter a phone number');
      return;
    }

    if (this.props.onSendAlert) {
      this.props.onSendAlert(
        this.state.phoneNumber,
        this.state.customMessage,
        this.state.selectedAlertFax._id
      );
    }

    this.setState({
      showSendAlert: false,
      phoneNumber: '',
      customMessage: '',
      selectedAlertFax: null
    });
  };

  formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  render() {
    const { alerts, selectedFax } = this.props;

    return (
      <div className="AlertPanel-container">
        {/* Recent Alerts Section */}
        <div className="AlertPanel-section">
          <h3 className="section-title">
            🚨 High Severity Alerts
            {alerts.length > 0 && (
              <span className="alert-count">{alerts.length}</span>
            )}
          </h3>
          
          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <div className="no-alerts-icon">✅</div>
                <p>No high severity alerts</p>
                <small>All fax results are within normal ranges</small>
              </div>
            ) : (
              alerts.map((alert, index) => (
                <div key={alert._id || index} className="alert-item">
                  <div className="alert-header">
                    <span className="alert-severity critical">
                      🔴 {alert.severityLevel} ({alert.severityScore}/10)
                    </span>
                    <span className="alert-time">
                      {this.formatDate(alert.processedAt)}
                    </span>
                  </div>
                  <div className="alert-content">
                    <div className="alert-file">📄 {alert.fileName}</div>
                    <div className="alert-reason">{alert.severityReason}</div>
                  </div>
                  <div className="alert-actions">
                    <button 
                      className="alert-action-btn send-alert"
                      onClick={() => this.handleSendAlert(alert)}
                    >
                      📱 Send Alert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Fax Details */}
        {selectedFax && (
          <div className="AlertPanel-section">
            <h3 className="section-title">📋 Fax Details</h3>
            <div className="fax-details">
              <div className="detail-row">
                <label>File Name:</label>
                <span>{selectedFax.fileName}</span>
              </div>
              <div className="detail-row">
                <label>Processed:</label>
                <span>{this.formatDate(selectedFax.processedAt)}</span>
              </div>
              <div className="detail-row">
                <label>Severity:</label>
                <span className={`severity-badge ${selectedFax.severityLevel.toLowerCase()}`}>
                  {selectedFax.severityLevel} ({selectedFax.severityScore}/10)
                </span>
              </div>
              <div className="detail-row">
                <label>Reason:</label>
                <span className="reason-text">{selectedFax.severityReason}</span>
              </div>
              <div className="detail-row full-width">
                <label>Summary:</label>
                <div className="summary-box">
                  {selectedFax.summary}
                </div>
              </div>
              <div className="detail-row full-width">
                <label>OCR Text:</label>
                <div className="ocr-text-box">
                  {selectedFax.transcription || 'No transcription available'}
                </div>
              </div>
              
              {selectedFax.severityScore >= 7 && (
                <div className="detail-actions">
                  <button 
                    className="action-btn send-alert-btn"
                    onClick={() => this.handleSendAlert(selectedFax)}
                  >
                    📱 Send Emergency Alert
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Send Alert Modal */}
        {this.state.showSendAlert && (
          <div className="AlertPanel-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h3>📱 Send Alert</h3>
                <button 
                  className="modal-close"
                  onClick={() => this.setState({ showSendAlert: false })}
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label>Phone Number:</label>
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    value={this.state.phoneNumber}
                    onChange={(e) => this.setState({ phoneNumber: e.target.value })}
                    className="phone-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Message:</label>
                  <textarea
                    rows="6"
                    value={this.state.customMessage}
                    onChange={(e) => this.setState({ customMessage: e.target.value })}
                    className="message-input"
                    placeholder="Alert message..."
                  />
                </div>
                
                <div className="alert-preview">
                  <strong>File:</strong> {this.state.selectedAlertFax?.fileName}<br/>
                  <strong>Severity:</strong> {this.state.selectedAlertFax?.severityLevel} ({this.state.selectedAlertFax?.severityScore}/10)
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  className="btn btn-send"
                  onClick={this.submitAlert}
                >
                  📤 Send Alert
                </button>
                <button 
                  className="btn btn-cancel"
                  onClick={() => this.setState({ showSendAlert: false })}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="AlertPanel-section">
          <h3 className="section-title">⚡ Quick Actions</h3>
          <div className="quick-actions">
            <button className="quick-action-btn">
              📊 Export Report
            </button>
            <button className="quick-action-btn">
              🔄 Refresh Data
            </button>
            <button className="quick-action-btn">
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="AlertPanel-section">
          <h3 className="section-title">💻 System Status</h3>
          <div className="system-status">
            <div className="status-item">
              <span className="status-label">Fax Monitor:</span>
              <span className="status-value running">🟢 Running</span>
            </div>
            <div className="status-item">
              <span className="status-label">OCR Service:</span>
              <span className="status-value running">🟢 Online</span>
            </div>
            <div className="status-item">
              <span className="status-label">AI Analysis:</span>
              <span className="status-value running">🟢 Active</span>
            </div>
            <div className="status-item">
              <span className="status-label">Database:</span>
              <span className="status-value running">🟢 Connected</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default AlertPanel; // ← Fixed: Added semicolon here!
