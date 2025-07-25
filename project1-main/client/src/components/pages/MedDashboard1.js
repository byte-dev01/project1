import React, { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, AlertCircle, CheckCircle, Clock, Users, 
  FileText, Brain, Bell, Search, MoreVertical, ArrowUp, ArrowDown,
  Calendar, Filter, Download, RefreshCw, Settings, ChevronDown,
  Zap, Shield, AlertTriangle, BarChart3, PieChart, Radio,
  Star, Menu, X, ChevronRight, Home, Folder, MessageSquare,
  HelpCircle, LogOut, Plus, Eye, Edit, Trash2, Phone, UserCheck,
  UserPlus, Stethoscope, ClipboardList, Timer, PhoneCall,
  Mail, UserX, Navigation, Layers, Heart, Target, TrendingDown
} from 'lucide-react';

export default function ComprehensiveMedicalDashboard() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('today');
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Real-time statistics
  const [stats, setStats] = useState({
    activeAlerts: 127,
    criticalCases: 8,
    avgDelayTime: 3.2,
    notificationRate: 94.5,
    patientMessages: 2456,
    patientAppointments: 189,
    patientWalkIns: 47,
    urgentReferrals: 23
  });

  // Alert data with comprehensive information
  const [alerts, setAlerts] = useState([
    {
      id: 'ALT-12345',
      patient: { 
        name: 'Zhang San', 
        id: 'PAT-001', 
        age: 65, 
        gender: 'Male',
        phone: '+86 138 0000 0001',
        email: 'zhangsan@email.com'
      },
      severity: 'critical',
      finding: 'Malignant lymphoma test positive',
      delayDays: 5,
      notificationStatus: 'sent',
      createdAt: '2024-01-15 14:30',
      lastNotified: '2024-01-15 14:30',
      assignedTo: 'Dr. Wang',
      department: 'Hematology',
      actionRequired: 'Immediate consultation needed',
      labResults: { wbc: 15.2, hemoglobin: 9.8 }
    },
    {
      id: 'ALT-12346',
      patient: { 
        name: 'Li Si', 
        id: 'PAT-002', 
        age: 42, 
        gender: 'Female',
        phone: '+86 138 0000 0002',
        email: 'lisi@email.com'
      },
      severity: 'high',
      finding: 'Tuberculosis positive',
      delayDays: 2,
      notificationStatus: 'pending',
      createdAt: '2024-01-15 16:20',
      lastNotified: null,
      assignedTo: 'Dr. Chen',
      department: 'Pulmonology',
      actionRequired: 'Isolation protocol initiation',
      labResults: { xray: 'Abnormal', sputum: 'Positive' }
    },
    {
      id: 'ALT-12347',
      patient: { 
        name: 'Wang Wu', 
        id: 'PAT-003', 
        age: 58, 
        gender: 'Male',
        phone: '+86 138 0000 0003',
        email: 'wangwu@email.com'
      },
      severity: 'medium',
      finding: 'CT scan abnormal shadow',
      delayDays: 1,
      notificationStatus: 'failed',
      createdAt: '2024-01-15 18:45',
      lastNotified: '2024-01-15 18:45',
      assignedTo: 'Dr. Liu',
      department: 'Radiology',
      actionRequired: 'Follow-up scan required',
      labResults: { ct: 'Shadow detected', size: '2.3cm' }
    },
    {
      id: 'ALT-12348',
      patient: { 
        name: 'Zhao Liu', 
        id: 'PAT-004', 
        age: 71, 
        gender: 'Female',
        phone: '+86 138 0000 0004',
        email: 'zhaoliu@email.com'
      },
      severity: 'critical',
      finding: 'Acute myocardial infarction markers elevated',
      delayDays: 7,
      notificationStatus: 'sent',
      createdAt: '2024-01-15 20:15',
      lastNotified: '2024-01-15 20:15',
      assignedTo: 'Dr. Zhang',
      department: 'Cardiology',
      actionRequired: 'Emergency cardiac intervention',
      labResults: { troponin: 'Elevated', ecg: 'ST elevation' }
    }
  ]);

  // Notifications data
  const [notifications] = useState([
    { id: 1, type: 'alert', message: 'New critical alert: Cardiac patient requires immediate attention', time: '2 mins ago', unread: true },
    { id: 2, type: 'success', message: 'Alert ALT-12344 has been resolved', time: '15 mins ago', unread: true },
    { id: 3, type: 'info', message: 'System maintenance scheduled for tonight', time: '1 hour ago', unread: false }
  ]);

  // Filter alerts based on selected filter and search
  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = (() => {
      switch (selectedFilter) {
        case 'critical':
          return alert.severity === 'critical';
        case 'pending':
          return alert.notificationStatus === 'pending';
        case 'delayed':
          return alert.delayDays > 3;
        default:
          return true;
      }
    })();

    const matchesSearch = searchQuery === '' || 
      alert.patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.finding.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        activeAlerts: prev.activeAlerts + Math.floor(Math.random() * 3 - 1),
        patientMessages: prev.patientMessages + Math.floor(Math.random() * 5),
        patientWalkIns: prev.patientWalkIns + Math.floor(Math.random() * 2)
      }));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRenotify = (alertId) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, notificationStatus: 'sent', lastNotified: new Date().toLocaleString() }
        : alert
    ));
  };

  const handleMarkResolved = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    setStats(prev => ({ ...prev, activeAlerts: Math.max(0, prev.activeAlerts - 1) }));
  };

  const handleViewDetails = (alert) => {
    setSelectedAlert(alert);
    setShowDetailsModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-semibold text-gray-900">Medical Alert System</h1>
              </div>

              {/* Search Bar */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                <Calendar className="w-4 h-4" />
                <span>Today</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-1.5 hover:bg-gray-100 rounded-md relative"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {notifications.filter(n => n.unread).length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.filter(n => n.unread).length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div key={notif.id} className={`p-3 hover:bg-gray-50 border-b border-gray-100 ${notif.unread ? 'bg-blue-50' : ''}`}>
                          <div className="flex items-start space-x-2">
                            <div className={`p-1 rounded ${
                              notif.type === 'alert' ? 'bg-red-100 text-red-600' :
                              notif.type === 'success' ? 'bg-green-100 text-green-600' :
                              notif.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {notif.type === 'alert' ? <AlertCircle className="w-3 h-3" /> :
                               notif.type === 'success' ? <CheckCircle className="w-3 h-3" /> :
                               notif.type === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                               <Bell className="w-3 h-3" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-gray-900">{notif.message}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{notif.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-1.5">
                <Plus className="w-4 h-4" />
                <span>Add Alert</span>
              </button>

              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                JD
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-4">
        {/* Compact Stats Grid - 2x4 layout */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <CompactStatsCard
            title="Active Alerts"
            value={stats.activeAlerts}
            trend={{ value: 12, positive: false, suffix: '%' }}
            color="red"
          />
          <CompactStatsCard
            title="Critical Cases"
            value={stats.criticalCases}
            trend={{ value: 3, positive: false }}
            color="orange"
          />
          <CompactStatsCard
            title="Avg. Delay Time"
            value={`${stats.avgDelayTime}d`}
            trend={{ value: 0.3, positive: true, prefix: '-', suffix: 'd' }}
            color="yellow"
          />
          <CompactStatsCard
            title="Notification Rate"
            value={`${stats.notificationRate}%`}
            trend={{ value: 2.1, positive: true, suffix: '%' }}
            color="green"
          />
          <CompactStatsCard
            title="Messages"
            value={stats.patientMessages.toLocaleString()}
            trend={{ value: 156, positive: true }}
            color="blue"
          />
          <CompactStatsCard
            title="Appointments"
            value={stats.patientAppointments}
            trend={{ value: 23, positive: true }}
            color="purple"
          />
          <CompactStatsCard
            title="Walk-ins"
            value={stats.patientWalkIns}
            trend={{ value: 8, positive: true }}
            color="indigo"
          />
          <CompactStatsCard
            title="Referrals"
            value={stats.urgentReferrals}
            trend={{ value: 5, positive: false }}
            color="pink"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alert List - Takes up 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Alert Management</h2>
                <div className="flex items-center space-x-2">
                  <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              
              {/* Compact Filter Buttons */}
              <div className="flex gap-2 mt-3">
                <CompactFilterButton 
                  active={selectedFilter === 'all'} 
                  onClick={() => setSelectedFilter('all')}
                  count={alerts.length}
                >
                  All
                </CompactFilterButton>
                <CompactFilterButton 
                  active={selectedFilter === 'critical'} 
                  onClick={() => setSelectedFilter('critical')}
                  count={alerts.filter(a => a.severity === 'critical').length}
                  color="red"
                >
                  Critical
                </CompactFilterButton>
                <CompactFilterButton 
                  active={selectedFilter === 'pending'} 
                  onClick={() => setSelectedFilter('pending')}
                  count={alerts.filter(a => a.notificationStatus === 'pending').length}
                  color="yellow"
                >
                  Pending
                </CompactFilterButton>
                <CompactFilterButton 
                  active={selectedFilter === 'delayed'} 
                  onClick={() => setSelectedFilter('delayed')}
                  count={alerts.filter(a => a.delayDays > 3).length}
                  color="orange"
                >
                  Delayed
                </CompactFilterButton>
              </div>
            </div>

            {/* Alert List */}
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No alerts found</p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <CompactAlertItem 
                    key={alert.id} 
                    alert={alert} 
                    onRenotify={handleRenotify}
                    onMarkResolved={handleMarkResolved}
                    onViewDetails={handleViewDetails}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar - Charts and Additional Info */}
          <div className="space-y-4">
            {/* Severity Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Severity Distribution</h3>
              <div className="space-y-2">
                <ProgressBar label="Critical" value={30} color="red" />
                <ProgressBar label="High" value={45} color="orange" />
                <ProgressBar label="Medium" value={20} color="yellow" />
                <ProgressBar label="Low" value={5} color="green" />
              </div>
            </div>

            {/* Department Stats */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Department Overview</h3>
              <div className="space-y-3">
                <DepartmentStat name="Cardiology" alerts={15} trend={3} />
                <DepartmentStat name="Hematology" alerts={12} trend={-2} />
                <DepartmentStat name="Pulmonology" alerts={8} trend={1} />
                <DepartmentStat name="Radiology" alerts={6} trend={0} />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-md flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span>Generate Report</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                <button className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-md flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span>Manage Staff</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                <button className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-md flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span>System Settings</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Alert Details</h2>
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Key Information Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Alert Information</h3>
                  <div className="space-y-3">
                    <InfoRow label="Alert ID" value={selectedAlert.id} />
                    <InfoRow label="Created" value={selectedAlert.createdAt} />
                    <InfoRow label="Delay" value={`${selectedAlert.delayDays} days`} />
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Patient Details</h3>
                  <div className="space-y-3">
                    <InfoRow label="Name" value={selectedAlert.patient.name} />
                    <InfoRow label="Age/Gender" value={`${selectedAlert.patient.age} yrs, ${selectedAlert.patient.gender}`} />
                    <InfoRow label="Contact" value={selectedAlert.patient.phone} />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Medical Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <InfoRow label="Finding" value={selectedAlert.finding} />
                  <InfoRow label="Department" value={selectedAlert.department} />
                  <InfoRow label="Assigned To" value={selectedAlert.assignedTo} />
                  <InfoRow label="Action Required" value={selectedAlert.actionRequired} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Severity</p>
                    <SeverityBadge severity={selectedAlert.severity} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <NotificationStatusBadge status={selectedAlert.notificationStatus} />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      handleRenotify(selectedAlert.id);
                      setShowDetailsModal(false);
                    }}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    Re-notify
                  </button>
                  <button
                    onClick={() => {
                      handleMarkResolved(selectedAlert.id);
                      setShowDetailsModal(false);
                    }}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact Component Definitions
function CompactStatsCard({ title, value, trend, color }) {
  const colorClasses = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    pink: 'text-pink-600'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
        </div>
        {trend && (
          <span className={`text-xs font-medium flex items-center ${
            trend.positive ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.positive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {trend.prefix}{trend.value}{trend.suffix || ''}
          </span>
        )}
      </div>
    </div>
  );
}

function CompactFilterButton({ active, onClick, count, children, color }) {
  const colorClasses = {
    red: 'text-red-700 bg-red-50',
    yellow: 'text-yellow-700 bg-yellow-50',
    orange: 'text-orange-700 bg-orange-50'
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
        active
          ? color ? colorClasses[color] : 'bg-indigo-100 text-indigo-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children} <span className="opacity-60">({count})</span>
    </button>
  );
}

function CompactAlertItem({ alert, onRenotify, onMarkResolved, onViewDetails }) {
  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">{alert.patient.name}</h3>
            <SeverityBadge severity={alert.severity} />
            <NotificationStatusBadge status={alert.notificationStatus} />
          </div>
          
          <p className="text-xs text-gray-600 mb-2">{alert.finding}</p>
          
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>{alert.department}</span>
            <span>•</span>
            <span className={alert.delayDays > 3 ? 'text-red-600 font-medium' : ''}>
              {alert.delayDays}d delay
            </span>
            <span>•</span>
            <span>{alert.assignedTo}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-4">
          <button
            onClick={() => onRenotify(alert.id)}
            className="p-1.5 hover:bg-blue-50 rounded transition-colors"
            title="Re-notify"
          >
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </button>
          <button
            onClick={() => onViewDetails(alert)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => onMarkResolved(alert.id)}
            className="p-1.5 hover:bg-green-50 rounded transition-colors"
            title="Mark resolved"
          >
            <CheckCircle className="w-4 h-4 text-green-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, color }) {
  const colorClasses = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500'
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{value}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full ${colorClasses[color]}`} 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DepartmentStat({ name, alerts, trend }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{name}</span>
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-900">{alerts}</span>
        {trend !== 0 && (
          <span className={`text-xs ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {trend > 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const severityConfig = {
    critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
    low: { label: 'Low', color: 'bg-green-100 text-green-700' }
  };

  const config = severityConfig[severity] || severityConfig.medium;

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.color}`}>
      {config.label}
    </span>
  );
}

function NotificationStatusBadge({ status }) {
  const statusConfig = {
    sent: { label: 'Sent', color: 'bg-green-100 text-green-700' },
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700' }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.color}`}>
      {config.label}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}