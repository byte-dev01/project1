import React, { Component } from "react";
import {
  BrowserRouter as Router,
  Switch, 
  Route,
  Link
} from "react-router-dom";

import Feed from "./pages/Feed.js";
import NotFound from "./pages/NotFound.js";
import Profile from "./pages/Profile.js";
import FaxDashboard from "./pages/FaxDashboard.js";
import Upload from "./pages/Upload.js";
import Chatbook from "./pages/Chatbook.js";
import MedicalAudioTranscriber from "./pages/Recorder3.js";
import Calendar from "./pages/Calendar.js";
import CalendarFeedLink from "./pages/CalendarFeedLink.js";
import Menu from "./modules/Menu.js";  // Import the Menu component

import { socket } from "../client-socket.js";
import { get, post } from "../utilities";

import "../utilities.css";
import "./App.css";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userId: undefined,
      isMenuOpen: false,  // Add menu state
    };
  }

  componentDidMount() {
    get("/api/whoami").then((user) => {
      if (user._id) {
        this.setState({ userId: user._id });
      }
    });
  }

  handleLogin = (res) => {
    console.log(`Logged in as ${res.profileObj.name}`);
    const userToken = res.tokenObj.id_token;
    post("/api/login", { token: userToken }).then((user) => {
      this.setState({ userId: user._id });
      post("/api/initsocket", { socketid: socket.id });
    });
  };

  handleLogout = () => {
    this.setState({ userId: undefined });
    post("/api/logout");
  };

  // Demo login function
  handleDemoLogin = () => {
    const demoLoginResponse = {
      profileObj: { 
        name: "Demo User",
        email: "demo@example.com" 
      },
      tokenObj: { 
        id_token: "demo-token-12345" 
      }
    };
    
    this.handleLogin(demoLoginResponse);
  };

  // Menu toggle functions
  toggleMenu = () => {
    this.setState({ isMenuOpen: !this.state.isMenuOpen });
  };

  closeMenu = () => {
    this.setState({ isMenuOpen: false });
  };

  render() {
    return (
      <Router>
        {/* Menu Component */}
        <Menu isOpen={this.state.isMenuOpen} onClose={this.closeMenu} />
        
        {/* UCLA Header */}
        <header className="header">
          <div className="header-content">
            <div className="nav-left">
              <button className="menu-button" onClick={this.toggleMenu}>
                <span>☰</span>
                <span>Menu</span>
              </button>
              <a href="#" className="logo">HealthBridge</a>
            </div>
            <div className="header-right">
              <button className="icon-button" title="Select language">🌐</button>
              <div className="user-menu">
                {this.state.userId ? (
                  <button
                    onClick={this.handleLogout}
                    className="demo-auth-btn"
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🚪 Logout (Demo)
                  </button>
                ) : (
                  <button
                    onClick={this.handleDemoLogin}
                    className="demo-auth-btn"
                    style={{
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🔑 Login (Demo)
                  </button>
                )}
                <span style={{fontSize: '0.7rem', marginLeft: '0.25rem'}}>▼</span>
              </div>
              <button className="icon-button" title="Log out">↪</button>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="App-container">
          <Switch>
            {/* Home/Dashboard Route */}
            <Route 
              exact 
              path="/" 
              render={() => (
                <div className="main-container">
                  <div className="main-content">
                    {/* Welcome Section */}
                    <div className="welcome-section">
                      <h1>Welcome, {this.state.userId ? "Rachel" : "Guest"}!</h1>
                      {/* Shortcuts */}
                      <div className="shortcuts">
                        <Link to={`/recorder/${this.state.userId || 'guest'}`} className="shortcut-button">
                          <div className="shortcut-icon">🎤</div>
                          <span>Clinical Notes</span>
                        </Link>
                        
                        <Link to={`/upload/${this.state.userId || 'guest'}`} className="shortcut-button">
                          <div className="shortcut-icon">🔍</div>
                          <span>OCR</span>
                        </Link>
                        <Link to="/chat" className="shortcut-button">
                          <div className="shortcut-icon">✉️</div>
                          <span>My Messages</span>
                        </Link>
                        <Link to="/fax-dashboard" className="shortcut-button">
                          <div className="shortcut-icon">📠</div>
                          <span>Fax Results</span>
                        </Link>

                        <a href="#" className="shortcut-button">
                          <div className="shortcut-icon">🧪</div>
                          <span>Lab results</span>
                        </a>
                        <a href="#" className="shortcut-button">
                          <div className="shortcut-icon">🔄</div>
                          <span>Referrals</span>
                        </a>
                        <a href="#" className="shortcut-button">
                          <div className="shortcut-icon">💰</div>
                          <span>Billing </span>
                        </a>
                      </div>
                    </div>

                    {/* Feed Items */}
                    <div className="feed-container">
                      {/* Test Result */}
                      <div className="feed-item">
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

                      {/* Upcoming Visit */}
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">📅</div>
                          <div className="feed-header">
                            <CalendarFeedLink />
                          </div>
                        </div>
                        <div className="feed-actions">
                          <a href="#" className="btn-primary">preCheck-in</a>
                          <a href="#" className="btn-secondary">View details</a>
                        </div>
                      </div>

                      {/* Billing */}
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">💵</div>
                          <div className="feed-header">
                            <div className="feed-title">Amount Due</div>
                            <div className="feed-description">You owe $63.00 • UCLA Health Physician Services • Last paid: $5.00 on 05/09/2025</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <a href="#" className="btn-primary">Pay now</a>
                          <a href="#" className="btn-secondary">View details</a>
                        </div>
                      </div>

                      {/* Email Verification Alert */}
                      <div className="feed-item alert-item">
                        <div className="feed-content">
                          <div className="feed-icon">⚠️</div>
                          <div className="feed-header">
                            <div className="feed-title">Your email address has not been verified</div>
                            <div className="feed-description">We need to verify that we can reach you at this email address by sending a one-time code to rachelli.purdue2@gmail.com</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <a href="#" className="btn-primary">Verify email</a>
                          <a href="#" className="btn-secondary">Update contact info</a>
                        </div>
                      </div>

                      {/* Announcement */}
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">📢</div>
                          <div className="feed-header">
                            <div className="feed-title">"Ask Me About myUCLAhealth" Day Held on Wednesday, July 9th</div>
                            <div className="feed-description">Visit us from 8am - 11am outside the Ronald Reagan cafeteria and 200 Medical Plaza lobby for help navigating the portal via your cell phone, iPad or laptop.</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <a href="#" className="btn-secondary">Dismiss</a>
                        </div>
                      </div>

                      {/* Health Reminders */}
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">❗</div>
                          <div className="feed-header">
                            <div className="feed-title">Physical Screen Overdue</div>
                            <div className="feed-description">Important preventive care reminder</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <a href="#" className="btn-primary">View details</a>
                        </div>
                      </div>

                      {/* New Message Alert */}
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">✉️</div>
                          <div className="feed-header">
                            <div className="feed-title">New message from Dr. Lars Hanson</div>
                            <div className="feed-description">Regarding your recent lab results • Received 2 hours ago</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <button className="btn-primary">Read message</button>
                        </div>
                      </div>

                      {/* Prescription Reminder */}
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">💊</div>
                          <div className="feed-header">
                            <div className="feed-title">Prescription Ready for Pickup</div>
                            <div className="feed-description">Your medication is ready at UCLA Pharmacy • Expires in 7 days</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <button className="btn-primary">View details</button>
                          <button className="btn-secondary">Find pharmacy</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <aside className="sidebar">
                    <h2 className="care-team-header">Care Team and Recent Providers</h2>
                    
                    <div className="provider-item">
                      <img className="provider-image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dbdbdb'/%3E%3C/svg%3E" alt="" />
                      <div className="provider-info">
                        <a href="#" className="provider-name">Lars Hanson, MD</a>
                        <div className="provider-specialty"><span className="provider-role">Primary Care Provider</span><br />Family Medicine</div>
                      </div>
                      <div className="provider-actions">
                        <button className="icon-button" title="Schedule an appointment">📅</button>
                        <button className="icon-button" title="Send a message">✉️</button>
                      </div>
                    </div>

                    <a href="#" className="link-all">See provider details and manage</a>
                  </aside>
                </div>
              )} 
            />
            
            {/* Routes */}
            <Route path="/profile/:userId" component={Profile} />
            <Route path="/chat" render={() => <Chatbook userId={this.state.userId} />} />
            <Route path="/upload/:userId" render={() => <Upload userId={this.state.userId} />} />
            <Route path="/recorder/:userId" render={() => <MedicalAudioTranscriber userId={this.state.userId} />} />
            <Route path="/fax-dashboard" render={() => <FaxDashboard userId={this.state.userId} />} />
            <Route path="/calendar" render={() => <Calendar />} />

            <Route component={NotFound} />
          </Switch>
        </div>
      </Router>
    );
  }
}

export default App;