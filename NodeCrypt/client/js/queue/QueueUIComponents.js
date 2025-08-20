// Queue Management UI Components
// React-style components for doctor/patient queue views

/**
 * Doctor Queue Dashboard Component
 * Shows encrypted patient list with wait times and priorities
 */
class DoctorQueueDashboard {
    constructor(containerId, queueManager) {
        this.containerId = containerId;
        this.queueManager = queueManager;
        this.queueData = null;
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="queue-dashboard">
                <!-- Queue Header -->
                <div class="queue-header">
                    <h2>📋 Patient Queue</h2>
                    <div class="queue-stats">
                        <div class="stat-item">
                            <span class="stat-label">Total Patients:</span>
                            <span class="stat-value" id="total-patients">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Emergency:</span>
                            <span class="stat-value emergency" id="emergency-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Regular:</span>
                            <span class="stat-value" id="regular-count">0</span>
                        </div>
                    </div>
                    <div class="queue-actions">
                        <button class="btn btn-primary" id="refresh-queue">🔄 Refresh</button>
                        <button class="btn btn-success" id="call-next">📞 Call Next</button>
                    </div>
                </div>

                <!-- Queue Controls -->
                <div class="queue-controls">
                    <div class="add-patient-form">
                        <h3>Add Patient to Queue</h3>
                        <div class="form-row">
                            <input type="text" id="patient-id" placeholder="Patient ID" required>
                            <select id="appointment-type">
                                <option value="consultation">Consultation</option>
                                <option value="follow-up">Follow-up</option>
                                <option value="emergency">Emergency</option>
                                <option value="procedure">Procedure</option>
                            </select>
                            <select id="priority">
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="emergency">Emergency</option>
                            </select>
                            <button class="btn btn-primary" id="add-patient">➕ Add Patient</button>
                        </div>
                    </div>
                </div>

                <!-- Queue List -->
                <div class="queue-list-container">
                    <div class="queue-list-header">
                        <div class="header-col position">#</div>
                        <div class="header-col patient-id">Patient ID</div>
                        <div class="header-col appointment">Appointment</div>
                        <div class="header-col priority">Priority</div>
                        <div class="header-col wait-time">Wait Time</div>
                        <div class="header-col estimated">Est. Time</div>
                        <div class="header-col actions">Actions</div>
                    </div>
                    <div class="queue-list" id="queue-list">
                        <div class="loading">Loading queue...</div>
                    </div>
                </div>

                <!-- Emergency Alerts -->
                <div class="emergency-alerts" id="emergency-alerts" style="display: none;">
                    <div class="alert alert-danger">
                        <strong>🚨 EMERGENCY:</strong>
                        <span id="emergency-message"></span>
                        <button class="btn btn-sm btn-outline" id="dismiss-emergency">Dismiss</button>
                    </div>
                </div>
            </div>
        `;

        this.setupStyles();
    }

    setupStyles() {
        const styles = `
            <style>
            .queue-dashboard {
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                margin: 20px 0;
            }
            
            .queue-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 15px;
            }
            
            .queue-stats {
                display: flex;
                gap: 20px;
            }
            
            .stat-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 8px;
                min-width: 80px;
            }
            
            .stat-label {
                font-size: 0.8rem;
                color: #6c757d;
                margin-bottom: 5px;
            }
            
            .stat-value {
                font-size: 1.5rem;
                font-weight: bold;
                color: #495057;
            }
            
            .stat-value.emergency {
                color: #dc3545;
            }
            
            .queue-actions {
                display: flex;
                gap: 10px;
            }
            
            .queue-controls {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            
            .add-patient-form h3 {
                margin: 0 0 15px 0;
                color: #495057;
            }
            
            .form-row {
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
            }
            
            .form-row input, .form-row select {
                padding: 8px 12px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 0.9rem;
            }
            
            .queue-list-container {
                border: 1px solid #dee2e6;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .queue-list-header {
                display: grid;
                grid-template-columns: 50px 150px 120px 100px 120px 120px 120px;
                background: #e9ecef;
                font-weight: bold;
                padding: 12px 0;
                border-bottom: 2px solid #dee2e6;
            }
            
            .header-col {
                padding: 0 12px;
                display: flex;
                align-items: center;
            }
            
            .queue-list {
                min-height: 200px;
                max-height: 500px;
                overflow-y: auto;
            }
            
            .queue-item {
                display: grid;
                grid-template-columns: 50px 150px 120px 100px 120px 120px 120px;
                padding: 12px 0;
                border-bottom: 1px solid #e9ecef;
                transition: background-color 0.2s;
            }
            
            .queue-item:hover {
                background-color: #f8f9fa;
            }
            
            .queue-item.priority {
                border-left: 4px solid #ffc107;
                background-color: #fff3cd;
            }
            
            .queue-item.emergency {
                border-left: 4px solid #dc3545;
                background-color: #f8d7da;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.8; }
            }
            
            .queue-col {
                padding: 0 12px;
                display: flex;
                align-items: center;
            }
            
            .priority-badge {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .priority-badge.normal {
                background: #d1ecf1;
                color: #0c5460;
            }
            
            .priority-badge.high {
                background: #fff3cd;
                color: #856404;
            }
            
            .priority-badge.emergency {
                background: #f8d7da;
                color: #721c24;
            }
            
            .btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: #007bff;
                color: white;
            }
            
            .btn-primary:hover {
                background: #0056b3;
            }
            
            .btn-success {
                background: #28a745;
                color: white;
            }
            
            .btn-success:hover {
                background: #1e7e34;
            }
            
            .btn-warning {
                background: #ffc107;
                color: #212529;
            }
            
            .btn-danger {
                background: #dc3545;
                color: white;
            }
            
            .btn-sm {
                padding: 4px 8px;
                font-size: 0.8rem;
            }
            
            .emergency-alerts {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                min-width: 300px;
            }
            
            .alert {
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .alert-danger {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            
            .loading {
                text-align: center;
                padding: 40px;
                color: #6c757d;
            }
            
            @media (max-width: 768px) {
                .queue-header {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .queue-stats {
                    justify-content: center;
                }
                
                .form-row {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .queue-list-header,
                .queue-item {
                    grid-template-columns: 1fr;
                    text-align: center;
                }
                
                .header-col,
                .queue-col {
                    padding: 5px;
                }
            }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        // Refresh queue
        document.getElementById('refresh-queue')?.addEventListener('click', () => {
            this.refreshQueue();
        });

        // Call next patient
        document.getElementById('call-next')?.addEventListener('click', () => {
            this.callNextPatient();
        });

        // Add patient to queue
        document.getElementById('add-patient')?.addEventListener('click', () => {
            this.addPatient();
        });

        // Dismiss emergency alert
        document.getElementById('dismiss-emergency')?.addEventListener('click', () => {
            this.dismissEmergencyAlert();
        });
    }

    async refreshQueue() {
        try {
            console.log('🔄 Refreshing queue...');
            this.queueData = await this.queueManager.getDoctorQueueView();
            this.renderQueue();
        } catch (error) {
            console.error('Failed to refresh queue:', error);
            this.showError('Failed to refresh queue: ' + error.message);
        }
    }

    renderQueue() {
        if (!this.queueData) return;

        // Update stats
        document.getElementById('total-patients').textContent = this.queueData.totalPatients;
        document.getElementById('emergency-count').textContent = this.queueData.priorityPatients || 0;
        document.getElementById('regular-count').textContent = this.queueData.regularPatients || 0;

        // Render queue list
        const queueList = document.getElementById('queue-list');
        
        if (this.queueData.queue.length === 0) {
            queueList.innerHTML = '<div class="loading">No patients in queue</div>';
            return;
        }

        const queueHTML = this.queueData.queue.map(patient => {
            const waitMinutes = Math.floor(patient.waitTime / 60000);
            const estMinutes = Math.ceil(patient.estimatedWaitTime / 60000);
            
            return `
                <div class="queue-item ${patient.priority}" data-patient-id="${patient.patientIdHash}">
                    <div class="queue-col position">${patient.position}</div>
                    <div class="queue-col patient-id">${patient.patientIdHash}</div>
                    <div class="queue-col appointment">${patient.appointmentType}</div>
                    <div class="queue-col priority">
                        <span class="priority-badge ${patient.priority}">${patient.priority}</span>
                    </div>
                    <div class="queue-col wait-time">${waitMinutes} min</div>
                    <div class="queue-col estimated">${estMinutes} min</div>
                    <div class="queue-col actions">
                        <button class="btn btn-sm btn-success" onclick="queueDashboard.callPatient('${patient.patientIdHash}')">📞 Call</button>
                        <button class="btn btn-sm btn-warning" onclick="queueDashboard.prioritizePatient('${patient.patientIdHash}')">🚨 Priority</button>
                        <button class="btn btn-sm btn-danger" onclick="queueDashboard.removePatient('${patient.patientIdHash}')">❌ Remove</button>
                    </div>
                </div>
            `;
        }).join('');

        queueList.innerHTML = queueHTML;
    }

    async addPatient() {
        try {
            const patientId = document.getElementById('patient-id').value;
            const appointmentType = document.getElementById('appointment-type').value;
            const priority = document.getElementById('priority').value;

            if (!patientId.trim()) {
                this.showError('Patient ID is required');
                return;
            }

            console.log(`➕ Adding patient: ${patientId} (${priority})`);
            
            const result = await this.queueManager.addPatient(
                patientId, 
                this.queueManager.userId, 
                appointmentType, 
                priority
            );

            // Clear form
            document.getElementById('patient-id').value = '';
            document.getElementById('appointment-type').value = 'consultation';
            document.getElementById('priority').value = 'normal';

            // Show success message
            this.showSuccess(`Patient added at position ${result.position}`);
            
            // Refresh queue
            await this.refreshQueue();

        } catch (error) {
            console.error('Failed to add patient:', error);
            this.showError('Failed to add patient: ' + error.message);
        }
    }

    async callPatient(patientIdHash) {
        try {
            console.log(`📞 Calling patient: ${patientIdHash}`);
            
            // In a real implementation, this would call the actual patient
            // For demo, we'll just remove them from queue
            await this.removePatient(patientIdHash, 'called');
            
            this.showSuccess('Patient called successfully');
            
        } catch (error) {
            console.error('Failed to call patient:', error);
            this.showError('Failed to call patient: ' + error.message);
        }
    }

    async prioritizePatient(patientIdHash) {
        try {
            console.log(`🚨 Prioritizing patient: ${patientIdHash}`);
            
            // Update priority to emergency
            await this.queueManager.updatePatientPriority(
                patientIdHash, 
                this.queueManager.userId, 
                'emergency'
            );
            
            this.showSuccess('Patient priority updated to emergency');
            await this.refreshQueue();
            
        } catch (error) {
            console.error('Failed to prioritize patient:', error);
            this.showError('Failed to update priority: ' + error.message);
        }
    }

    async removePatient(patientIdHash, reason = 'cancelled') {
        try {
            console.log(`❌ Removing patient: ${patientIdHash}`);
            
            await this.queueManager.removePatient(
                patientIdHash, 
                this.queueManager.userId, 
                reason
            );
            
            this.showSuccess('Patient removed from queue');
            await this.refreshQueue();
            
        } catch (error) {
            console.error('Failed to remove patient:', error);
            this.showError('Failed to remove patient: ' + error.message);
        }
    }

    async callNextPatient() {
        try {
            if (!this.queueData || this.queueData.queue.length === 0) {
                this.showError('No patients in queue');
                return;
            }

            const nextPatient = this.queueData.queue[0];
            await this.callPatient(nextPatient.patientIdHash);
            
        } catch (error) {
            console.error('Failed to call next patient:', error);
            this.showError('Failed to call next patient: ' + error.message);
        }
    }

    showEmergencyAlert(message) {
        const alertsContainer = document.getElementById('emergency-alerts');
        const messageElement = document.getElementById('emergency-message');
        
        if (alertsContainer && messageElement) {
            messageElement.textContent = message;
            alertsContainer.style.display = 'block';
            
            // Auto-dismiss after 30 seconds
            setTimeout(() => {
                this.dismissEmergencyAlert();
            }, 30000);
        }
    }

    dismissEmergencyAlert() {
        const alertsContainer = document.getElementById('emergency-alerts');
        if (alertsContainer) {
            alertsContainer.style.display = 'none';
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1001;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
        `;
        
        if (type === 'success') {
            toast.style.background = '#d4edda';
            toast.style.border = '1px solid #c3e6cb';
            toast.style.color = '#155724';
        } else {
            toast.style.background = '#f8d7da';
            toast.style.border = '1px solid #f5c6cb';
            toast.style.color = '#721c24';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    startAutoRefresh() {
        // Auto-refresh every 5 seconds
        this.updateInterval = setInterval(() => {
            this.refreshQueue();
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

/**
 * Patient Queue Status Component
 * Shows patient's position and estimated wait time
 */
class PatientQueueStatus {
    constructor(containerId, queueManager, patientId) {
        this.containerId = containerId;
        this.queueManager = queueManager;
        this.patientId = patientId;
        this.positionData = null;
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="patient-queue-status">
                <div class="status-header">
                    <h2>📋 Your Queue Status</h2>
                    <button class="btn btn-sm btn-outline" id="refresh-status">🔄 Refresh</button>
                </div>
                
                <div class="status-content" id="status-content">
                    <div class="loading">Checking queue status...</div>
                </div>
                
                <div class="queue-info">
                    <div class="info-section">
                        <h3>ℹ️ Queue Information</h3>
                        <ul>
                            <li>You will be called when it's your turn</li>
                            <li>Please stay available for your appointment</li>
                            <li>Emergency cases may be prioritized</li>
                            <li>Estimated times are approximate</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        this.setupPatientStyles();
    }

    setupPatientStyles() {
        const styles = `
            <style>
            .patient-queue-status {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }
            
            .status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .status-header h2 {
                margin: 0;
                color: white;
            }
            
            .status-content {
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                padding: 30px;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .in-queue {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }
            
            .position-display {
                font-size: 4rem;
                font-weight: bold;
                color: #ffc107;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                margin-bottom: 10px;
            }
            
            .position-label {
                font-size: 1.2rem;
                opacity: 0.9;
                margin-bottom: 20px;
            }
            
            .wait-time-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 20px;
                width: 100%;
            }
            
            .wait-time-item {
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 15px;
                text-align: center;
            }
            
            .wait-time-value {
                font-size: 1.8rem;
                font-weight: bold;
                display: block;
                margin-bottom: 5px;
            }
            
            .wait-time-label {
                font-size: 0.9rem;
                opacity: 0.8;
            }
            
            .not-in-queue {
                text-align: center;
                padding: 40px 20px;
            }
            
            .not-in-queue-icon {
                font-size: 4rem;
                margin-bottom: 20px;
            }
            
            .not-in-queue-message {
                font-size: 1.2rem;
                opacity: 0.9;
            }
            
            .queue-info {
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 20px;
            }
            
            .info-section h3 {
                margin: 0 0 15px 0;
                color: white;
            }
            
            .info-section ul {
                list-style-type: none;
                padding: 0;
                margin: 0;
            }
            
            .info-section li {
                padding: 5px 0;
                padding-left: 20px;
                position: relative;
                opacity: 0.9;
            }
            
            .info-section li:before {
                content: "•";
                color: #ffc107;
                font-weight: bold;
                position: absolute;
                left: 0;
            }
            
            .btn-outline {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.5);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-outline:hover {
                background: rgba(255,255,255,0.1);
                border-color: white;
            }
            
            .loading {
                opacity: 0.7;
                font-style: italic;
            }
            
            @media (max-width: 768px) {
                .status-header {
                    flex-direction: column;
                    gap: 10px;
                    text-align: center;
                }
                
                .position-display {
                    font-size: 3rem;
                }
                
                .wait-time-info {
                    grid-template-columns: 1fr;
                }
            }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        document.getElementById('refresh-status')?.addEventListener('click', () => {
            this.refreshStatus();
        });
    }

    async refreshStatus() {
        try {
            console.log('🔄 Refreshing patient status...');
            
            // Get patient's queue position
            this.positionData = await this.queueManager.getPatientQueueView(
                this.patientId,
                null // Let the system determine the doctor
            );
            
            this.renderStatus();
            
        } catch (error) {
            console.error('Failed to refresh patient status:', error);
            this.showError('Failed to refresh status: ' + error.message);
        }
    }

    renderStatus() {
        const statusContent = document.getElementById('status-content');
        if (!statusContent) return;

        if (!this.positionData || !this.positionData.inQueue) {
            statusContent.innerHTML = `
                <div class="not-in-queue">
                    <div class="not-in-queue-icon">📋</div>
                    <div class="not-in-queue-message">
                        You are not currently in any queue
                    </div>
                </div>
            `;
            return;
        }

        const waitMinutes = Math.ceil(this.positionData.estimatedWaitTime / 60000);
        const position = this.positionData.position;

        statusContent.innerHTML = `
            <div class="in-queue">
                <div class="position-display">#${position}</div>
                <div class="position-label">Your position in queue</div>
                
                <div class="wait-time-info">
                    <div class="wait-time-item">
                        <span class="wait-time-value">${waitMinutes}</span>
                        <span class="wait-time-label">Minutes Est. Wait</span>
                    </div>
                    <div class="wait-time-item">
                        <span class="wait-time-value">${this.positionData.totalPatients || 0}</span>
                        <span class="wait-time-label">Total in Queue</span>
                    </div>
                    <div class="wait-time-item">
                        <span class="wait-time-value">${this.formatTime(this.positionData.lastUpdated)}</span>
                        <span class="wait-time-label">Last Updated</span>
                    </div>
                </div>
            </div>
        `;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-error';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
            padding: 12px 20px;
            border-radius: 8px;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            font-weight: bold;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    startAutoRefresh() {
        // Auto-refresh every 10 seconds for patient view
        this.updateInterval = setInterval(() => {
            this.refreshStatus();
        }, 10000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

/**
 * Admin Queue Overview Component
 * Shows statistics across all doctor queues
 */
class AdminQueueOverview {
    constructor(containerId, queueManager) {
        this.containerId = containerId;
        this.queueManager = queueManager;
        this.overviewData = null;
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="admin-queue-overview">
                <div class="overview-header">
                    <h2>👨‍⚕️ Queue System Overview</h2>
                    <div class="header-actions">
                        <button class="btn btn-primary" id="refresh-overview">🔄 Refresh</button>
                        <button class="btn btn-secondary" id="export-report">📊 Export Report</button>
                    </div>
                </div>
                
                <div class="system-stats">
                    <div class="stat-card">
                        <div class="stat-icon">🏥</div>
                        <div class="stat-info">
                            <div class="stat-value" id="total-doctors">0</div>
                            <div class="stat-label">Active Doctors</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-info">
                            <div class="stat-value" id="total-patients">0</div>
                            <div class="stat-label">Total Patients</div>
                        </div>
                    </div>
                    <div class="stat-card emergency">
                        <div class="stat-icon">🚨</div>
                        <div class="stat-info">
                            <div class="stat-value" id="emergency-patients">0</div>
                            <div class="stat-label">Emergency Cases</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⏱️</div>
                        <div class="stat-info">
                            <div class="stat-value" id="avg-wait">0</div>
                            <div class="stat-label">Avg Wait (min)</div>
                        </div>
                    </div>
                </div>
                
                <div class="doctor-queues-table">
                    <h3>Doctor Queue Status</h3>
                    <div class="table-container">
                        <table class="overview-table">
                            <thead>
                                <tr>
                                    <th>Doctor</th>
                                    <th>Total Patients</th>
                                    <th>Emergency</th>
                                    <th>Regular</th>
                                    <th>Avg Wait</th>
                                    <th>Last Activity</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="doctors-table-body">
                                <tr>
                                    <td colspan="7" class="loading">Loading doctor queues...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.setupAdminStyles();
    }

    setupAdminStyles() {
        const styles = `
            <style>
            .admin-queue-overview {
                background: white;
                border-radius: 12px;
                padding: 25px;
                margin: 20px 0;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .overview-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 15px;
            }
            
            .header-actions {
                display: flex;
                gap: 10px;
            }
            
            .system-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                padding: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            
            .stat-card.emergency {
                background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            }
            
            .stat-icon {
                font-size: 2.5rem;
                opacity: 0.9;
            }
            
            .stat-info {
                flex: 1;
            }
            
            .stat-value {
                font-size: 2rem;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .stat-label {
                font-size: 0.9rem;
                opacity: 0.8;
            }
            
            .doctor-queues-table h3 {
                margin: 0 0 15px 0;
                color: #495057;
            }
            
            .table-container {
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .overview-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .overview-table th {
                background: #f8f9fa;
                padding: 15px 12px;
                text-align: left;
                font-weight: 600;
                color: #495057;
                border-bottom: 2px solid #dee2e6;
            }
            
            .overview-table td {
                padding: 12px;
                border-bottom: 1px solid #e9ecef;
                color: #495057;
            }
            
            .overview-table tr:hover {
                background-color: #f8f9fa;
            }
            
            .status-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .status-badge.active {
                background: #d1ecf1;
                color: #0c5460;
            }
            
            .status-badge.busy {
                background: #fff3cd;
                color: #856404;
            }
            
            .status-badge.emergency {
                background: #f8d7da;
                color: #721c24;
            }
            
            .emergency-count {
                color: #dc3545;
                font-weight: bold;
            }
            
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            .btn-secondary:hover {
                background: #545b62;
            }
            
            .loading {
                text-align: center;
                padding: 40px;
                color: #6c757d;
                font-style: italic;
            }
            
            @media (max-width: 768px) {
                .overview-header {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .system-stats {
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                }
                
                .table-container {
                    overflow-x: auto;
                }
                
                .overview-table {
                    min-width: 600px;
                }
            }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        document.getElementById('refresh-overview')?.addEventListener('click', () => {
            this.refreshOverview();
        });

        document.getElementById('export-report')?.addEventListener('click', () => {
            this.exportReport();
        });
    }

    async refreshOverview() {
        try {
            console.log('🔄 Refreshing admin overview...');
            this.overviewData = await this.queueManager.getAdminQueueOverview();
            this.renderOverview();
        } catch (error) {
            console.error('Failed to refresh admin overview:', error);
            this.showError('Failed to refresh overview: ' + error.message);
        }
    }

    renderOverview() {
        if (!this.overviewData) return;

        // Update system stats
        const stats = this.overviewData.systemStats;
        document.getElementById('total-doctors').textContent = this.overviewData.doctors.length;
        document.getElementById('total-patients').textContent = stats.totalPatients;
        document.getElementById('emergency-patients').textContent = stats.emergencyCount;
        
        const avgWait = this.calculateAverageWaitTime();
        document.getElementById('avg-wait').textContent = Math.round(avgWait);

        // Render doctors table
        const tableBody = document.getElementById('doctors-table-body');
        
        if (this.overviewData.doctors.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="loading">No active doctor queues</td></tr>';
            return;
        }

        const doctorsHTML = this.overviewData.doctors.map(doctor => {
            const status = this.getDoctorStatus(doctor);
            const lastActivity = this.formatLastActivity(doctor.lastActivity);
            const avgWait = Math.round(doctor.averageWaitTime / 60000); // Convert to minutes

            return `
                <tr>
                    <td>${doctor.doctorId}</td>
                    <td>${doctor.totalPatients}</td>
                    <td class="emergency-count">${doctor.priorityPatients}</td>
                    <td>${doctor.regularPatients}</td>
                    <td>${avgWait} min</td>
                    <td>${lastActivity}</td>
                    <td><span class="status-badge ${status.class}">${status.text}</span></td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = doctorsHTML;
    }

    calculateAverageWaitTime() {
        if (!this.overviewData || this.overviewData.doctors.length === 0) return 0;
        
        const totalWait = this.overviewData.doctors.reduce((sum, doctor) => 
            sum + doctor.averageWaitTime, 0);
        
        return totalWait / this.overviewData.doctors.length / 60000; // Convert to minutes
    }

    getDoctorStatus(doctor) {
        if (doctor.priorityPatients > 0) {
            return { class: 'emergency', text: 'Emergency' };
        } else if (doctor.totalPatients > 10) {
            return { class: 'busy', text: 'Busy' };
        } else if (doctor.totalPatients > 0) {
            return { class: 'active', text: 'Active' };
        } else {
            return { class: 'active', text: 'Available' };
        }
    }

    formatLastActivity(timestamp) {
        if (!timestamp) return 'Never';
        
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    exportReport() {
        if (!this.overviewData) {
            this.showError('No data to export');
            return;
        }

        // Create CSV report
        const csvData = [
            ['Doctor ID', 'Total Patients', 'Emergency', 'Regular', 'Avg Wait (min)', 'Last Activity'],
            ...this.overviewData.doctors.map(doctor => [
                doctor.doctorId,
                doctor.totalPatients,
                doctor.priorityPatients,
                doctor.regularPatients,
                Math.round(doctor.averageWaitTime / 60000),
                this.formatLastActivity(doctor.lastActivity)
            ])
        ];

        const csvContent = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `queue-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showSuccess('Report exported successfully');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
        `;
        
        if (type === 'success') {
            toast.style.background = '#d4edda';
            toast.style.border = '1px solid #c3e6cb';
            toast.style.color = '#155724';
        } else {
            toast.style.background = '#f8d7da';
            toast.style.border = '1px solid #f5c6cb';
            toast.style.color = '#721c24';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    startAutoRefresh() {
        // Auto-refresh every 30 seconds for admin view
        this.updateInterval = setInterval(() => {
            this.refreshOverview();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Export components
export { DoctorQueueDashboard, PatientQueueStatus, AdminQueueOverview };