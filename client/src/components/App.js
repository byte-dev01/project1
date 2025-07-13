import React from "react";
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { UIProvider } from './contexts/UIContext';

// Pages
import LoginPage from "./pages/LoginPage";
import ClinicLogin from "./pages/ClinicLogin"; 
import Dashboard from "./pages/GeneralDashboard";
import FaxDashboard from "./pages/FaxDashboard";
import Upload from "./pages/Upload";
import Chatbook from "./pages/Chatbook";
import MedicalAudioTranscriber from "./pages/Recorder3";
import Profile from "./pages/Profile";
import NotFound from "./modules/NotFound";
import Unauthorized from "./modules/Unauthorized";
import Calendar from "./pages/Calendar";

import "../utilities.css";
import "./App.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <UIProvider>
            <div className="App-container">
              <Switch>
                {/* Public Routes */}
                <Route exact path="/" render={() => <Redirect to="/dashboard" />} />
                <Route path="/login" component={LoginPage} />
                <Route path="/clinic-select" component={ClinicLogin} />
                <Route path="/unauthorized" component={Unauthorized} />
                
                {/* Protected Routes - General Access (any authenticated user) */}
                <ProtectedRoute path="/dashboard/:userId" component={Dashboard} />
                <ProtectedRoute path="/profile/:userId" component={Profile} />
                <ProtectedRoute path="/chat" component={Chatbook} />
                <ProtectedRoute path="/calendar" component={Calendar} />
                
                {/* Protected Routes - Staff Level and Above */}
                <ProtectedRoute 
                  path="/upload/:userId" 
                  component={Upload}
                  roles={['staff', 'doctor', 'moderator', 'admin']}
                />
                
                {/* Protected Routes - Doctor Level and Above */}
                <ProtectedRoute 
                  path="/recorder/:userId" 
                  component={MedicalAudioTranscriber}
                  roles={['doctor', 'admin']}
                />
                
                <ProtectedRoute 
                  path="/fax-dashboard" 
                  component={FaxDashboard}
                  roles={['doctor', 'admin']}
                />
                
                {/* Admin Only Routes */}
                <ProtectedRoute 
                  path="/admin" 
                  component={() => <div>Admin Dashboard (To be implemented)</div>}
                  roles={['admin']}
                />
                
                {/* 404 - Must be last */}
                <Route component={NotFound} />
              </Switch>
            </div>
          </UIProvider>
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
/*import React, { Component } from "react";
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
import Menu from "./modules/Menu.js";

import { socket } from "../client-socket.js";
import { get, post } from "../utilities";
import { ProtectedRoute } from '../modules/ProtectedRoute';

import "../utilities.css";
import "./App.css";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userId: undefined,
      isMenuOpen: false,
      // 🆕 新增状态
      selectedClinic: null,
      showClinicModal: false,
      userName: "",
      userRoles: [], // Add this
    };
  }

  componentDidMount() {
    get("/api/whoami").then((user) => {
      if (user._id) {
        this.setState({ 
          userId: user._id,
          // 🆕 从用户信息中获取诊所和角色
          selectedClinic: user.clinicName || null,
          userName: user.name || user.username || "User",
          userRole: user.userType || user.role || null
        });
      }
    });
  }

  handleLogin = (res) => {
    console.log(`Logged in as ${res.profileObj.name}`);
    const userToken = res.tokenObj.id_token;
    post("/api/auth/verify", { token: userToken }).then((user) => {
      this.setState({ 
        userId: loginResponse.user.id,
        selectedClinic: loginResponse.clinic.id,
        userName: loginResponse.user.name,
        userRole: loginResponse.user.roles
      });
      post("/api/initsocket", { socketid: socket.id });
    });
  };

  handleLogout = () => {
    this.setState({ 
      userId: loginResponse.user.id,
       selectedClinic: loginResponse.clinic.id,
      userName: loginResponse.user.name,
      userRole: loginResponse.user.roles
    });
    post("/api/auth/logout");
  };

    // 🆕 模拟不同诊所的不同用户
  toggleMenu = () => {
    this.setState({ isMenuOpen: !this.state.isMenuOpen });
  };

  closeMenu = () => {
    this.setState({ isMenuOpen: false });
  };

  render() {
    return (
      <Router>
        //{/* Menu Component }
        
        <Menu isOpen={this.state.isMenuOpen} onClose={this.closeMenu} />
        
        //{/* 🆕 诊所选择模态框 }
        
        {this.state.showClinicModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '10px',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h2 style={{ marginBottom: '20px' }}>选择您的诊所</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {["Downtown Medical Clinic", "Westside Health Center", "Eastside Clinic", "Community Hospital"].map(clinic => (
                  <button
                    key={clinic}
                    onClick={() => this.handleClinicSelect(clinic)}
                    style={{
                      padding: '15px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.background = 'white'}
                  >
                    <div style={{ fontWeight: 'bold' }}>{clinic}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      {clinic === "Downtown Medical Clinic" && "主院区 - 综合医疗服务"}
                      {clinic === "Westside Health Center" && "西区分院 - 专科门诊"}
                      {clinic === "Eastside Clinic" && "东区诊所 - 社区医疗"}
                      {clinic === "Community Hospital" && "社区医院 - 急诊服务"}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => this.setState({ showClinicModal: false })}
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
        
        //{/* UCLA Header }
        <header className="header">
          <div className="header-content">
            <div className="nav-left">
              <button className="menu-button" onClick={this.toggleMenu}>
                <span>☰</span>
                <span>Menu</span>
              </button>
              <a href="#" className="logo">
                HealthBridge
               // { 🆕 显示当前诊所 }
                {this.state.selectedClinic && (
                  <span style={{ 
                    fontSize: '12px', 
                    marginLeft: '10px',
                    color: '#666',
                    fontWeight: 'normal'
                  }}>
                    - {this.state.selectedClinic}
                  </span>
                )}
              </a>
            </div>
            
            <div className="header-right">
              <button className="icon-button" title="Select language">🌐</button>
              <div className="user-menu">
                {this.state.userId ? (
                  <>
                    //{/* 🆕 显示用户角色标签 }
                    {this.state.userRole && (
                      <span style={{
                        background: this.state.userRole === 'doctor' ? '#28a745' : 
                                   this.state.userRole === 'nurse' ? '#17a2b8' : 
                                   this.state.userRole === 'admin' ? '#dc3545' : '#6c757d',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        marginRight: '10px'
                      }}>
                        {this.state.userRole === 'doctor' ? '医生' :
                         this.state.userRole === 'nurse' ? '护士' :
                         this.state.userRole === 'admin' ? '管理员' : '患者'}
                      </span>
                    )}
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
                      🚪 退出登录
                    </button>
                  </>
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
                    🔑 选择诊所登录
                  </button>
                )}
                <span style={{fontSize: '0.7rem', marginLeft: '0.25rem'}}>▼</span>
              </div>
              <button className="icon-button" title="Log out">↪</button>
            </div>
          </div>
        </header>

        //{/* Main content area }
        <div className="App-container">
          <Switch>
          //  {/* Home/Dashboard Route }
            <Route 
              exact 
              path="/" 
              render={() => (
                <div className="main-container">
                  <div className="main-content">
                   // {/* Welcome Section }
                    <div className="welcome-section">
                     // {/* 🆕 显示用户名和诊所 }
                      <h1>Welcome, {this.state.userName}!</h1>
                      {this.state.selectedClinic && (
                        <p style={{ color: '#666', marginTop: '-10px', marginBottom: '20px' }}>
                          当前诊所：{this.state.selectedClinic}
                        </p>
                      )}
                      
                     //{/* 🆕 根据角色显示不同的快捷方式 }
                      <div className="shortcuts">
                      //  {/* 医生和护士可以看到的功能 }
                        {['doctor', 'nurse'].includes(this.state.userRole) && (
                          <>
                            <Link to={`/recorder/${this.state.userId || 'guest'}`} className="shortcut-button">
                              <div className="shortcut-icon">🎤</div>
                              <span>Clinical Notes</span>
                            </Link>
                            
                            <Link to={`/upload/${this.state.userId || 'guest'}`} className="shortcut-button">
                              <div className="shortcut-icon">🔍</div>
                              <span>OCR</span>
                            </Link>
                          </>
                        )}
                        
                      //  {/* 所有用户都能看到的功能 }
                        <Link to="/chat" className="shortcut-button">
                          <div className="shortcut-icon">✉️</div>
                          <span>My Messages</span>
                        </Link>
                        
                      //  {/* 只有医生能看到的功能 }
                        {this.state.userRole === 'doctor' && (
                          <Link to="/fax-dashboard" className="shortcut-button">
                            <div className="shortcut-icon">📠</div>
                            <span>Fax Results</span>
                          </Link>
                        )}

                        <a href="#" className="shortcut-button">
                          <div className="shortcut-icon">🧪</div>
                          <span>Lab results</span>
                        </a>
                        
                      //  {/* 患者特有功能 }
                        {this.state.userRole === 'patient' && (
                          <a href="#" className="shortcut-button">
                            <div className="shortcut-icon">🔄</div>
                            <span>Referrals</span>
                          </a>
                        )}
                        
                        <a href="#" className="shortcut-button">
                          <div className="shortcut-icon">💰</div>
                          <span>Billing</span>
                        </a>
                      </div>
                    </div>

                  //  {/* Feed Items - 保持您原有的内容 }
                    <div className="feed-container">
                  //    {/* 🆕 添加诊所特定的通知 }
                      {this.state.selectedClinic && (
                        <div className="feed-item" style={{ background: '#e3f2fd' }}>
                          <div className="feed-content">
                            <div className="feed-icon">🏥</div>
                            <div className="feed-header">
                              <div className="feed-title">{this.state.selectedClinic} 通知</div>
                              <div className="feed-description">
                                {this.state.selectedClinic === "Downtown Medical Clinic" && "本周六正常开诊，欢迎预约"}
                                {this.state.selectedClinic === "Westside Health Center" && "新增骨科专家门诊，周三、周五开放"}
                                {this.state.selectedClinic === "Eastside Clinic" && "流感疫苗已到货，请及时接种"}
                                {this.state.selectedClinic === "Community Hospital" && "急诊部24小时开放"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                    //  {/* 保留您原有的所有 feed items }
                    //  {/* Test Result }
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

                    //  {/* ... 保留您所有其他的 feed items ... }
                      
                    //  {/* Upcoming Visit }
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

                    //  {/* Billing }
                      <div className="feed-item">
                        <div className="feed-content">
                          <div className="feed-icon">💵</div>
                          <div className="feed-header">
                            <div className="feed-title">Amount Due</div>
                            <div className="feed-description">You owe $63.00 • {this.state.selectedClinic || "UCLA Health"} • Last paid: $5.00 on 05/09/2025</div>
                          </div>
                        </div>
                        <div className="feed-actions">
                          <a href="#" className="btn-primary">Pay now</a>
                          <a href="#" className="btn-secondary">View details</a>
                        </div>
                      </div>

                  //    {/* 保留其他所有 feed items... }
                    </div>
                  </div>

                //  {/* Sidebar }
                  <aside className="sidebar">
                    <h2 className="care-team-header">
                //      {/* 🆕 根据诊所显示不同的医疗团队 }
                      {this.state.selectedClinic ? `${this.state.selectedClinic} 医疗团队` : "Care Team and Recent Providers"}
                    </h2>
                    
                    <div className="provider-item">
                      <img className="provider-image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dbdbdb'/%3E%3C/svg%3E" alt="" />
                      <div className="provider-info">
                        <a href="#" className="provider-name">
                    //      {/* 🆕 根据诊所显示不同的医生 }
                          {this.state.selectedClinic === "Downtown Medical Clinic" ? "Dr. Smith" :
                           this.state.selectedClinic === "Westside Health Center" ? "Dr. Jones" :
                           "Lars Hanson, MD"}
                        </a>
                        <div className="provider-specialty">
                          <span className="provider-role">Primary Care Provider</span>
                          <br />Family Medicine
                        </div>
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
            
          //  {/* Routes - 传递诊所信息到各个页面 }
            <Route path="/profile/:userId" component={Profile} />
            <Route path="/chat" render={() => <Chatbook userId={this.state.userId} clinicName={this.state.selectedClinic} />} />
            <Route path="/upload/:userId" render={() => <Upload userId={this.state.userId} clinicName={this.state.selectedClinic} />} />
            <Route path="/recorder/:userId" render={() => <MedicalAudioTranscriber userId={this.state.userId} clinicName={this.state.selectedClinic} />} />
            <Route path="/fax-dashboard" render={() => <FaxDashboard userId={this.state.userId} clinicName={this.state.selectedClinic} />} />
            <Route path="/calendar" render={() => <Calendar clinicName={this.state.selectedClinic} />} />

            <Route component={NotFound} />
          </Switch>
        </div>
      </Router>
    );
  }
}

export default App;
*/