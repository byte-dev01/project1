// pages/Dashboard.js - Main application UI after login
import React, { Component } from "react";
import { Link } from "react-router-dom";
import Menu from "../modules/Menu";
import CalendarFeedLink from "./CalendarFeedLink";
import "./Dashboard.css";
import Feed from "./pages/Feed.js";
import NotFound from "./pages/NotFound.js";
import Profile from "./pages/Profile.js";
import FaxDashboard from "./pages/FaxDashboard.js";
import Upload from "./pages/Upload.js";
import Chatbook from "./pages/Chatbook.js";
import MedicalAudioTranscriber from "./pages/Recorder3.js";
import Calendar from "./pages/Calendar.js";
import CalendarFeedLink from "./pages/CalendarFeedLink.js";
import Menu from "./modules/Menu.js";

import { socket } from "../client-socket.js";
import { get, post } from "../utilities";
import { ProtectedRoute } from '../modules/ProtectedRoute';

class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isMenuOpen: false
    };
  }

  toggleMenu = () => {
    this.setState({ isMenuOpen: !this.state.isMenuOpen });
  };

  closeMenu = () => {
    this.setState({ isMenuOpen: false });
  };

  // Helper to check if user has a specific role
  hasRole = (role) => {
    return this.props.userRoles.some(userRole => 
      userRole.toLowerCase().includes(role.toLowerCase())
    );
  };

  getRoleDisplay = () => {
    if (this.hasRole('admin')) return 'Administrator';
    if (this.hasRole('doctor')) return 'Doctor';
    if (this.hasRole('moderator')) return 'Moderator';
    if (this.hasRole('staff')) return 'Staff';
    return 'Patient';
  };

  getRoleColor = () => {
    if (this.hasRole('admin')) return '#dc3545';
    if (this.hasRole('doctor')) return '#28a745';
    if (this.hasRole('moderator')) return '#ffc107';
    if (this.hasRole('staff')) return '#17a2b8';
    return '#6c757d';
  };

  render() {
    const { userId, userName, clinicName, onLogout } = this.props;

    return (
      <div className="dashboard-container">
        {/* Menu Component */}
        <Menu isOpen={this.state.isMenuOpen} onClose={this.closeMenu} />
        
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="nav-left">
              <button className="menu-button" onClick={this.toggleMenu}>
                <span>☰</span>
                <span>Menu</span>
              </button>
              <a href="/" className="logo">
                HealthBridge
                {clinicName && (
                  <span className="clinic-name">
                    - {clinicName}
                  </span>
                )}
              </a>
            </div>
            <div className="header-right">
              <button className="icon-button" title="Select language">🌐</button>
              <div className="user-menu">
                <span className="user-name">{userName}</span>
                <span 
                  className="role-badge"
                  style={{ backgroundColor: this.getRoleColor() }}
                >
                  {this.getRoleDisplay()}
                </span>
                <button
                  onClick={onLogout}
                  className="logout-button"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="dashboard-content">
          <div className="main-container">
            <div className="main-content">
              {/* Welcome Section */}
              <div className="welcome-section">
                <h1>Welcome, {userName}!</h1>
                <p className="clinic-info">
                  {clinicName} • {this.getRoleDisplay()}
                </p>
                
                {/* Role-based Shortcuts */}
                <div className="shortcuts">
                  {this.renderShortcuts()}
                </div>
              </div>

              {/* Feed Items */}
              <div className="feed-container">
                {this.renderFeedItems()}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="sidebar">
              {this.renderSidebar()}
            </aside>
          </div>
        </div>
      </div>
    );
  }

  renderShortcuts() {
    const { userId } = this.props;
    const shortcuts = [];

    // All users can see messages
    shortcuts.push(
      <Link to="/chat" key="chat" className="shortcut-button">
        <div className="shortcut-icon">✉️</div>
        <span>Messages</span>
      </Link>
    );

    // Staff and above can use OCR
    if (this.hasRole('staff') || this.hasRole('doctor') || this.hasRole('moderator') || this.hasRole('admin')) {
      shortcuts.push(
        <Link to={`/upload/${userId}`} key="upload" className="shortcut-button">
          <div className="shortcut-icon">🔍</div>
          <span>OCR Upload</span>
        </Link>
      );
    }

    // Doctors can use clinical notes
    if (this.hasRole('doctor') || this.hasRole('admin')) {
      shortcuts.push(
        <Link to={`/recorder/${userId}`} key="recorder" className="shortcut-button">
          <div className="shortcut-icon">🎤</div>
          <span>Clinical Notes</span>
        </Link>
      );
      
      shortcuts.push(
        <Link to="/fax-dashboard" key="fax" className="shortcut-button">
          <div className="shortcut-icon">📠</div>
          <span>Fax Dashboard</span>
        </Link>
      );
    }

    // Common shortcuts for all
    shortcuts.push(
      <a href="#" key="lab" className="shortcut-button">
        <div className="shortcut-icon">🧪</div>
        <span>Lab Results</span>
      </a>
    );

    // Patient-specific shortcuts
    if (!this.hasRole('staff') && !this.hasRole('doctor') && !this.hasRole('moderator')) {
      shortcuts.push(
        <a href="#" key="referrals" className="shortcut-button">
          <div className="shortcut-icon">🔄</div>
          <span>Referrals</span>
        </a>
      );
    }

    shortcuts.push(
      <a href="#" key="billing" className="shortcut-button">
        <div className="shortcut-icon">💰</div>
        <span>Billing</span>
      </a>
    );

    return shortcuts;
  }

  renderFeedItems() {
    const { clinicName } = this.props;
    const feedItems = [];

    // Clinic-specific notification
    if (clinicName) {
      feedItems.push(
        <div className="feed-item clinic-notification" key="clinic">
          <div className="feed-content">
            <div className="feed-icon">🏥</div>
            <div className="feed-header">
              <div className="feed-title">{clinicName} Notice</div>
              <div className="feed-description">
                Welcome to HealthBridge secure medical system
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Role-specific feed items
    if (this.hasRole('doctor')) {
      feedItems.push(
        <div className="feed-item" key="pending-reviews">
          <div className="feed-content">
            <div className="feed-icon">📋</div>
            <div className="feed-header">
              <div className="feed-title">Pending Reviews</div>
              <div className="feed-description">3 lab results awaiting review</div>
            </div>
          </div>
          <div className="feed-actions">
            <a href="#" className="btn-primary">Review Now</a>
          </div>
        </div>
      );
    }

    // Common feed items
    feedItems.push(
      <div className="feed-item" key="test-results">
        <div className="feed-content">
          <div className="feed-icon">🧪</div>
          <div className="feed-header">
            <div className="feed-title">Updated Results</div>
            <div className="feed-description">From Tuesday June 17, 2025</div>
          </div>
        </div>
        <div className="feed-actions">
          <a href="#" className="btn-primary">View results</a>
        </div>
      </div>
    );

    feedItems.push(
      <div className="feed-item" key="calendar">
        <div className="feed-content">
          <div className="feed-icon">📅</div>
          <div className="feed-header">
            <CalendarFeedLink />
          </div>
        </div>
        <div className="feed-actions">
          <a href="#" className="btn-primary">Check-in</a>
          <a href="#" className="btn-secondary">View details</a>
        </div>
      </div>
    );

    feedItems.push(
      <div className="feed-item" key="billing">
        <div className="feed-content">
          <div className="feed-icon">💵</div>
          <div className="feed-header">
            <div className="feed-title">Amount Due</div>
            <div className="feed-description">
              You owe $63.00 • {clinicName || "HealthBridge"} • Last paid: $5.00 on 05/09/2025
            </div>
          </div>
        </div>
        <div className="feed-actions">
          <a href="#" className="btn-primary">Pay now</a>
          <a href="#" className="btn-secondary">View details</a>
        </div>
      </div>
    );

    return feedItems;
  }

  renderSidebar() {
    const { clinicName } = this.props;

    return (
      <>
        <h2 className="care-team-header">
          {clinicName ? `${clinicName} Care Team` : "Care Team"}
        </h2>
        
        <div className="provider-item">
          <img 
            className="provider-image" 
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dbdbdb'/%3E%3C/svg%3E" 
            alt="Provider" 
          />
          <div className="provider-info">
            <a href="#" className="provider-name">
              Dr. Sarah Johnson
            </a>
            <div className="provider-specialty">
              <span className="provider-role">Primary Care Provider</span>
              <br />Family Medicine
            </div>
          </div>
          <div className="provider-actions">
            <button className="icon-button" title="Schedule appointment">📅</button>
            <button className="icon-button" title="Send message">✉️</button>
          </div>
        </div>

        {this.hasRole('doctor') && (
          <div className="doctor-stats">
            <h3>Today's Schedule</h3>
            <div className="stat-item">
              <span className="stat-label">Appointments:</span>
              <span className="stat-value">8</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Completed:</span>
              <span className="stat-value">3</span>
            </div>
          </div>
        )}

        <a href="#" className="link-all">See all providers</a>
      </>
    );
  }
}

export default Dashboard;