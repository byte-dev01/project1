import React, { Component } from "react";
import { get, post } from "../../utilities.js";
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
      selectedFax: null
    };
  }

  componentDidMount() {
    document.title = "Fax Monitor Dashboard";
    this.loadDashboardData();
    
    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  componentWillUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadDashboardData = async () => {
    try {
      // Load fax records from your MongoDB API
      const faxResponse = await get("/api/fax-records", { 
        timeRange: this.state.selectedTimeRange 
      });
      
      // Load system stats
      const statsResponse = await get("/api/fax-stats", {
        timeRange: this.state.selectedTimeRange
      });

      // Process severity distribution for chart
      const severityDistribution = this.processSeverityData(faxResponse.faxData || []);
      
      // Get recent high-severity alerts
      const recentAlerts = (faxResponse.faxData || [])
        .filter(fax => fax.severityScore >= 7)
        .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))
        .slice(0, 5);

      this.setState({
        faxData: faxResponse.faxData || [],
        stats: statsResponse.stats || this.state.stats,
        severityDistribution,
        recentAlerts,
        loading: false
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      this.setState({ loading: false });
    }
  };

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
    this.setState({ selectedTimeRange: timeRange }, () => {
      this.loadDashboardData();
    });
  };

  handleSeverityClick = (severityLevel) => {
    this.setState({ selectedSeverityLevel: severityLevel });
  };

  handleFaxSelect = (fax) => {
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
              System: {this.state.stats.systemStatus}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="FaxDashboard-statsRow">
          <StatCard 
            title="Total Processed"
            value={this.state.stats.totalProcessed}
            icon="📄"
            trend="+12%"
          />
          <StatCard 
            title="Today's Faxes"
            value={this.state.stats.todayProcessed}
            icon="📥"
            trend="+5"
          />
          <StatCard 
            title="High Severity"
            value={this.state.stats.highSeverityCount}
            icon="🚨"
            trend="3 new"
            isAlert={this.state.stats.highSeverityCount > 0}
          />
          <StatCard 
            title="Avg Processing"
            value={`${this.state.stats.averageProcessingTime}s`}
            icon="⏱️"
            trend="-2s"
          />
        </div>

        {/* Main Content */}
        <div className="FaxDashboard-mainContent">
          {/* Left Column - Charts and Tables */}
          <div className="FaxDashboard-leftColumn">
            <div className="FaxDashboard-chartSection">
              <h3 className="section-title">Severity Distribution</h3>
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