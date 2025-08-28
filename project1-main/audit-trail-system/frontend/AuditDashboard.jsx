import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Search, Filter, Download, AlertTriangle, 
  Activity, Users, Shield, Clock 
} from 'lucide-react';
import './AuditDashboard.css';

const AuditDashboard = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [filters, setFilters] = useState({
    userId: '',
    patientId: '',
    action: '',
    startDate: '',
    endDate: '',
    severity: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  const severityColors = {
    low: '#4CAF50',
    medium: '#FFC107',
    high: '#FF9800',
    critical: '#F44336'
  };

  const actionTypes = [
    'VIEW_PHI', 'UPDATE_PHI', 'DELETE_PHI', 'EXPORT_PHI',
    'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'PERMISSION_DENIED'
  ];

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      });

      const response = await fetch(`/api/audit/logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setAuditLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch(`/api/audit/statistics?timeRange=${selectedTimeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  }, [selectedTimeRange]);

  const fetchAnomalies = useCallback(async () => {
    try {
      const response = await fetch('/api/audit/anomalies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setAnomalies(data.anomalies);
    } catch (error) {
      console.error('Failed to fetch anomalies:', error);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
    fetchStatistics();
    fetchAnomalies();

    const interval = setInterval(() => {
      fetchStatistics();
      fetchAnomalies();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchAuditLogs, fetchStatistics, fetchAnomalies]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async (format) => {
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        format
      });

      const response = await fetch(`/api/audit/export?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="severity-icon critical" />;
      case 'high':
        return <Shield className="severity-icon high" />;
      case 'medium':
        return <Activity className="severity-icon medium" />;
      default:
        return <Clock className="severity-icon low" />;
    }
  };

  return (
    <div className="audit-dashboard">
      <div className="dashboard-header">
        <h1>Audit Trail Dashboard</h1>
        <div className="header-actions">
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="time-range-selector"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button onClick={() => handleExport('csv')} className="export-btn">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => handleExport('json')} className="export-btn">
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="anomaly-alerts">
          <h3><AlertTriangle /> Security Anomalies Detected</h3>
          <div className="anomaly-list">
            {anomalies.map((anomaly, index) => (
              <div key={index} className={`anomaly-item ${anomaly.severity}`}>
                <strong>{anomaly.type}</strong>
                <span>{JSON.stringify(anomaly.details)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {statistics && (
        <div className="statistics-section">
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-icon"><Activity /></div>
              <div className="stat-value">{statistics.summary.totalActions}</div>
              <div className="stat-label">Total Actions</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Users /></div>
              <div className="stat-value">{statistics.summary.uniqueUsersCount}</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-card danger">
              <div className="stat-icon"><AlertTriangle /></div>
              <div className="stat-value">{statistics.summary.failedActions}</div>
              <div className="stat-label">Failed Actions</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-icon"><Shield /></div>
              <div className="stat-value">{statistics.severityDistribution.critical || 0}</div>
              <div className="stat-label">Critical Events</div>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-container">
              <h3>Activity Timeline</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={statistics.hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3>Action Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(statistics.actionDistribution).map(([action, count]) => ({ action, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="action" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3>Severity Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(statistics.severityDistribution).map(([severity, count]) => ({ 
                      name: severity, 
                      value: count 
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(statistics.severityDistribution).map(([severity], index) => (
                      <Cell key={`cell-${index}`} fill={severityColors[severity]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="filters-section">
        <h3><Filter /> Filters</h3>
        <div className="filter-controls">
          <input
            type="text"
            name="userId"
            placeholder="User ID"
            value={filters.userId}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input
            type="text"
            name="patientId"
            placeholder="Patient ID"
            value={filters.patientId}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <select
            name="action"
            value={filters.action}
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="">All Actions</option>
            {actionTypes.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            name="severity"
            value={filters.severity}
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input
            type="datetime-local"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input
            type="datetime-local"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <button onClick={fetchAuditLogs} className="search-btn">
            <Search size={16} /> Search
          </button>
        </div>
      </div>

      <div className="logs-section">
        <h3>Audit Logs</h3>
        {loading ? (
          <div className="loading">Loading audit logs...</div>
        ) : (
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Patient ID</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.auditId} className={`log-row ${log.severity}`}>
                    <td>{formatTimestamp(log.timestamp)}</td>
                    <td>{getSeverityIcon(log.severity)} {log.severity}</td>
                    <td>
                      <div className="user-info">
                        <span className="user-id">{log.userId}</span>
                        <span className="user-role">{log.userRole}</span>
                      </div>
                    </td>
                    <td>{log.action}</td>
                    <td>{log.resourceType}</td>
                    <td>{log.patientId || '-'}</td>
                    <td>{log.ipAddress}</td>
                    <td>
                      <span className={`status ${log.success ? 'success' : 'failed'}`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td>
                      {log.errorMessage || 
                       (log.details && Object.keys(log.details).length > 0 
                        ? JSON.stringify(log.details) 
                        : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button 
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button 
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.pages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditDashboard;