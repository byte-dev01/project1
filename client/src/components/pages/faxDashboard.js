import React, { Component } from "react";
import { get, post } from "../../utilities.js";
import { socket } from "../../client-socket.js"; // 添加 socket 导入
import SeverityChart from "../modules/SeverityChart.js";
import FaxTable from "../modules/FaxTable.js";
import StatCard from "../modules/StatCard.js";
import AlertPanel from "../modules/AlertPanel.js";
import "./FaxDashboard.css";

console.log("🔍 FaxDashboard imports:", {
  SeverityChart,
  FaxTable,
  StatCard,
  AlertPanel
});

class FaxDashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      faxData: [],
      stats: {
        totalProcessed: 0,
        todayProcessed: 0,
        highSeverityCount: 0,
        averageProcessingTime: 0,
        systemStatus: "Running"
      },
      severityDistribution: [],
      recentAlerts: [],
      selectedTimeRange: "24h",
      loading: true,
      selectedSeverityLevel: null,
      selectedFax: null,
      notifications: [], // 添加通知状态
      lastUpdate: null   // 添加最后更新时间
    };
  }

  componentDidMount() {
    document.title = "Fax Monitor Dashboard";
    this.loadDashboardData();
    
    // 设置实时监听
    this.setupRealTimeListeners();
    
    // Auto-refresh every 30 seconds (作为备份机制)
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  componentWillUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // 清理 Socket 监听器
    socket.off("dataChanged");
    console.log("🔌 Socket listeners cleaned up");
  }

  // 🔥 设置实时监听器
  setupRealTimeListeners = () => {
    // 监听数据变化通知
    socket.on("dataChanged", (notification) => {
      console.log("📡 Received data change notification:", notification);
      
      // 显示通知
      this.showNotification(notification.message || "Data updated");
      
      // 重新加载数据
      if (notification.action === "refresh") {
        console.log("🔄 Refreshing dashboard data due to database change");
        this.loadDashboardData();
      }
    });
    
    console.log("🔌 Real-time listeners setup complete");
  };

  // 显示实时通知
  showNotification = (message) => {
    const notification = {
      id: Date.now(),
      message,
      timestamp: new Date()
    };
    
    this.setState(prevState => ({
      notifications: [notification, ...prevState.notifications.slice(0, 4)] // 保持最新5个通知
    }));
    
    // 自动移除通知
    setTimeout(() => {
      this.setState(prevState => ({
        notifications: prevState.notifications.filter(n => n.id !== notification.id)
      }));
    }, 5000);
    
    // 浏览器通知（如果用户允许）
    if (Notification.permission === "granted") {
      new Notification("Fax Dashboard", {
        body: message,
        icon: "📠"
      });
    } else if (Notification.permission === "default") {
      // 首次请求通知权限
      Notification.requestPermission();
    }
  };

  loadDashboardData = async () => {
    try {
      console.log(`🔄 Loading dashboard data for timeRange: ${this.state.selectedTimeRange}`);
      
      // Load fax records from your MongoDB API
      const faxResponse = await get("/api/fax-records", { 
        timeRange: this.state.selectedTimeRange 
      });
      
      // Load system stats
      const statsResponse = await get("/api/fax-stats", {
        timeRange: this.state.selectedTimeRange
      });

      console.log(`📊 Loaded ${faxResponse.faxData?.length || 0} fax records from MongoDB`);

      // Process severity distribution for chart (如果API没有返回，则计算)
      const severityDistribution = statsResponse.severityDistribution?.length > 0 
        ? this.processSeverityDataFromAPI(statsResponse.severityDistribution)
        : this.processSeverityData(faxResponse.faxData || []);
      
      // Get recent high-severity alerts
      const recentAlerts = (faxResponse.faxData || [])
        .filter(fax => (fax.severityScore || 0) >= 7)
        .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))
        .slice(0, 5);

      this.setState({
        faxData: faxResponse.faxData || [],
        stats: statsResponse.stats || this.state.stats,
        severityDistribution,
        recentAlerts,
        loading: false,
        lastUpdate: new Date()
      });
      
      console.log("✅ Dashboard data loaded successfully from MongoDB");
    } catch (error) {
      console.error("❌ Failed to load dashboard data:", error);
      this.setState({ 
        loading: false,
        stats: {
          ...this.state.stats,
          systemStatus: "Error"
        }
      });
    }
  };

  // 处理从API返回的严重程度分布数据
  processSeverityDataFromAPI = (apiData) => {
    const severityMap = {
      '轻度': { color: '#10B981', range: '1-3', order: 1 },
      '中度': { color: '#F59E0B', range: '4-6', order: 2 },
      '重度': { color: '#EF4444', range: '7-8', order: 3 },
      '危急': { color: '#DC2626', range: '9-10', order: 4 }
    };

    // 初始化所有级别
    const result = Object.entries(severityMap).map(([level, config]) => ({
      level,
      count: 0,
      color: config.color,
      range: config.range,
      order: config.order
    }));

    // 填入API数据
    apiData.forEach(item => {
      const level = item._id || '轻度';
      const found = result.find(r => r.level === level);
      if (found) {
        found.count = item.count || 0;
      }
    });

    return result.sort((a, b) => a.order - b.order);
  };

  // 原有的客户端严重程度数据处理（作为备份）
  processSeverityData = (faxData) => {
    const severityLevels = {
      '轻度': { count: 0, color: '#10B981', range: '1-3' },
      '中度': { count: 0, color: '#F59E0B', range: '4-6' },
      '重度': { count: 0, color: '#EF4444', range: '7-8' },
      '危急': { count: 0, color: '#DC2626', range: '9-10' }
    };

    faxData.forEach(fax => {
      const level = fax.severityLevel || '轻度';
      if (severityLevels[level]) {
        severityLevels[level].count++;
      }
    });

    return Object.entries(severityLevels).map(([level, data]) => ({
      level,
      count: data.count,
      color: data.color,
      range: data.range
    }));
  };

  handleTimeRangeChange = (timeRange) => {
    console.log(`📅 Time range changed to: ${timeRange}`);
    this.setState({ 
      selectedTimeRange: timeRange,
      loading: true 
    }, () => {
      this.loadDashboardData();
    });
  };

  handleSeverityClick = (severityLevel) => {
    console.log(`🔍 Severity level clicked: ${severityLevel}`);
    this.setState({ selectedSeverityLevel: severityLevel });
  };

  handleFaxSelect = (fax) => {
    console.log("📄 Fax selected:", fax.fileName);
    this.setState({ selectedFax: fax });
  };

  handleSendAlert = async (phoneNumber, message, faxId) => {
    try {
      await post("/api/send-twilio-alert", {
        phoneNumber,
        message,
        faxId
      });
      alert("Alert sent successfully!");
    } catch (error) {
      console.error("Failed to send alert:", error);
      alert("Failed to send alert");
    }
  };

  render() {
    if (!this.props.userId) {
      return <div className="FaxDashboard-login">Please log in to access the Fax Dashboard</div>;
    }

    if (this.state.loading) {
      return <div className="FaxDashboard-loading">Loading dashboard...</div>;
    }

    const filteredFaxData = this.state.selectedSeverityLevel 
      ? this.state.faxData.filter(fax => fax.severityLevel === this.state.selectedSeverityLevel)
      : this.state.faxData;

    return (
      <div className="FaxDashboard-container">
        {/* 实时通知 */}
        {this.state.notifications.length > 0 && (
          <div className="FaxDashboard-notifications">
            {this.state.notifications.map(notification => (
              <div key={notification.id} className="notification-toast">
                <div className="notification-icon">📠</div>
                <div className="notification-content">
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {notification.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                <button 
                  className="notification-close"
                  onClick={() => this.setState(prev => ({
                    notifications: prev.notifications.filter(n => n.id !== notification.id)
                  }))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="FaxDashboard-header">
          <h1 className="FaxDashboard-title">📠 Fax Monitor Dashboard</h1>
          <div className="FaxDashboard-controls">
            <select 
              value={this.state.selectedTimeRange}
              onChange={(e) => this.handleTimeRangeChange(e.target.value)}
              className="FaxDashboard-timeRange"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <div className="FaxDashboard-status">
              <span className={`status-indicator ${this.state.stats.systemStatus.toLowerCase()}`}></span>
              System: {this.state.stats.systemStatus} (Real-time ✅)
            </div>
            {this.state.lastUpdate && (
              <div className="last-update">
                Last update: {this.state.lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="FaxDashboard-statsRow">
          <StatCard 
            title="Total Processed"
            value={this.state.stats.totalProcessed}
            icon="📄"
            trend={`${this.state.faxData.length} in range`}
          />
          <StatCard 
            title="Today's Faxes"
            value={this.state.stats.todayProcessed}
            icon="📥"
            trend="today"
          />
          <StatCard 
            title="High Severity"
            value={this.state.stats.highSeverityCount}
            icon="🚨"
            trend={this.state.stats.highSeverityCount > 0 ? "needs attention" : "all clear"}
            isAlert={this.state.stats.highSeverityCount > 0}
          />
          <StatCard 
            title="Avg Processing"
            value={`${this.state.stats.averageProcessingTime}s`}
            icon="⏱️"
            trend="per fax"
          />
        </div>

        {/* Main Content */}
        <div className="FaxDashboard-mainContent">
          {/* Left Column - Charts and Tables */}
          <div className="FaxDashboard-leftColumn">
            <div className="FaxDashboard-chartSection">
              <h3 className="section-title">
                Severity Distribution 
                <span className="record-count">({this.state.faxData.length} records)</span>
              </h3>
              <SeverityChart 
                data={this.state.severityDistribution}
                onSeverityClick={this.handleSeverityClick}
                selectedLevel={this.state.selectedSeverityLevel}
              />
            </div>

            <div className="FaxDashboard-tableSection">
              <h3 className="section-title">
                Recent Fax Records 
                {this.state.selectedSeverityLevel && (
                  <span className="filter-badge">
                    Filtered: {this.state.selectedSeverityLevel}
                    <button 
                      onClick={() => this.setState({ selectedSeverityLevel: null })}
                      className="clear-filter"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </h3>
              <FaxTable 
                data={filteredFaxData}
                onFaxSelect={this.handleFaxSelect}
                selectedFax={this.state.selectedFax}
              />
            </div>
          </div>

          {/* Right Column - Alerts and Details */}
          <div className="FaxDashboard-rightColumn">
            <AlertPanel 
              alerts={this.state.recentAlerts}
              selectedFax={this.state.selectedFax}
              onSendAlert={this.handleSendAlert}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default FaxDashboard;