// pages/GeneralDashboard.js - Fixed to use AuthContext
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Menu from "../modules/Menu";
import CalendarFeedLink from "./CalendarFeedLink";
import "./GeneralDashboard.css";

const Dashboard = () => {
  const { user, logout, hasRole } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const getRoleDisplay = () => {
    if (hasRole('admin')) return 'Administrator';
    if (hasRole('doctor')) return 'Doctor';
    if (hasRole('moderator')) return 'Moderator';
    if (hasRole('staff')) return 'Staff';
    return 'Patient';
  };

  const getRoleColor = () => {
    if (hasRole('admin')) return '#dc3545';
    if (hasRole('doctor')) return '#28a745';
    if (hasRole('moderator')) return '#ffc107';
    if (hasRole('staff')) return '#17a2b8';
    return '#6c757d';
  };

  const renderShortcuts = () => {
    const shortcuts = [];

    // All users can see messages - NO userId in URL
    shortcuts.push(
      <Link to="/chat" key="chat" className="shortcut-button">
        <div className="shortcut-icon">✉️</div>
        <span>Messages</span>
      </Link>
    );

    // Staff and above can use OCR
    if (hasRole('staff') || hasRole('doctor') || hasRole('moderator') || hasRole('admin')) {
      shortcuts.push(
        <Link to={`/upload`} key="upload" className="shortcut-button">
          <div className="shortcut-icon">🔍</div>
          <span>OCR Upload</span>
        </Link>
      );
    }

    // Doctors can use clinical notes
    if (hasRole('doctor') || hasRole('admin') || hasRole('moderator')) {
      shortcuts.push(
        <Link to={`/recorder`} key="recorder" className="shortcut-button">
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
      
      shortcuts.push(
        <Link to="/medical-management" key="med-dash" className="shortcut-button">
          <div className="shortcut-icon">👨‍👩‍👧‍👦</div>
          <span>Medical Management</span>
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
    if (!hasRole('staff') && !hasRole('doctor') && !hasRole('moderator')) {
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
  };

  const renderFeedItems = () => {
    const feedItems = [];

    // Clinic-specific notification
    if (user?.clinicName) {
      feedItems.push(
        <div className="feed-item clinic-notification" key="clinic">
          <div className="feed-content">
            <div className="feed-icon">🏥</div>
            <div className="feed-header">
              <div className="feed-title">{user.clinicName} Notice</div>
              <div className="feed-description">
                Welcome to HealthBridge secure medical system
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Role-specific feed items
    if (hasRole('doctor')) {
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
              You owe $00.00 • {user?.clinicName || "HealthBridge"} • Last paid: $0.00 on 06/01/2025
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
  };

  const renderSidebar = () => {
    return (
      <>
        <h2 className="care-team-header">
          {user?.clinicName ? `${user.clinicName} Care Team` : "Care Team"}
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

        {hasRole('doctor') && (
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
  };

  // If user is not loaded yet, show loading
  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Menu Component */}
      <Menu isOpen={isMenuOpen} onClose={closeMenu} />
      
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="nav-left">
            <button className="menu-button" onClick={toggleMenu}>
              <div>☰</div>
              <div>Menu</div>
            </button>
            <a href="/" className="logo">
              HealthBridge
              {user?.clinicName && (
                <span className="clinic-name">
                  - {user.clinicName}
                </span>
              )}
            </a>
          </div>
          <div className="header-right">
            <button className="icon-button" title="Select language">🌐</button>
            <div className="user-menu">
              <span className="user-name">{user?.name || user?.username || 'User'}</span>
              <span 
                className="role-badge"
                style={{ backgroundColor: getRoleColor() }}
              >
                {getRoleDisplay()}
              </span>
              <button
                onClick={logout}
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
              <h1>Welcome, {user?.name || user?.username || 'User'}!</h1>
              <p className="clinic-info">
                {user?.clinicName || 'HealthBridge'} • {getRoleDisplay()}
              </p>
              
              {/* Role-based Shortcuts */}
              <div className="shortcuts">
                {renderShortcuts()}
              </div>
            </div>

            {/* Feed Items */}
            <div className="feed-container">
              {renderFeedItems()}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="sidebar">
            {renderSidebar()}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;