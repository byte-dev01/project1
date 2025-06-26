import React, { Component } from "react";
import { Link } from "react-router-dom";
// Temporarily removed: import GoogleLogin, { GoogleLogout } from "react-google-login";

import "./NavBar.css";

/**
 * The navigation bar at the top of all pages. Takes no props.
 */
class NavBar extends Component {
  constructor(props) {
    super(props);
  }

  // Demo login function
  handleDemoLogin = () => {
    // Simulate the Google login response structure
    const demoLoginResponse = {
      profileObj: { 
        name: "Demo User",
        email: "demo@example.com" 
      },
      tokenObj: { 
        id_token: "demo-token-12345" 
      }
    };
    
    this.props.handleLogin(demoLoginResponse);
  };

  render() {
    return (
      <nav className="NavBar-container">
        <div className="NavBar-title u-inlineBlock">Catbook</div>
        <div className="NavBar-linkContainer u-inlineBlock">
          <Link to="/" className="NavBar-link">
            Home
          </Link>
          {this.props.userId && (
            <Link to={`/profile/${this.props.userId}`} className="NavBar-link">
              Profile
            </Link>
          )}
          <Link to="/chat/" className="NavBar-link">
            Chat
          </Link>
          {this.props.userId && (
            <Link to={`/upload/${this.props.userId}`} className="NavBar-link">
              Upload
            </Link>
          )}
          {this.props.userId && (
            <Link to={`/recorder/${this.props.userId}`} className="NavBar-link">
              Recorder
            </Link>
          )}
          {this.props.userId && (
            <Link to="/fax-dashboard/" className="NavBar-link NavBar-faxDashboard">
              📠 Fax Dashboard
            </Link>
          )}
          
          {/* Demo Login/Logout Buttons */}
          {this.props.userId ? (
            <button
              onClick={this.props.handleLogout}
              className="NavBar-link NavBar-login demo-auth-btn"
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🚪 Logout (Demo)
            </button>
          ) : (
            <button
              onClick={this.handleDemoLogin}
              className="NavBar-link NavBar-login demo-auth-btn"
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔑 Login (Demo)
            </button>
          )}
        </div>
      </nav>
    );
  }
}

export default NavBar;