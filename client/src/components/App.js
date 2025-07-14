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


// In your App.js, replace the problematic routes with simpler ones:

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
                <Route
                  path="/login"
                  render={(props) => (
                    <LoginPage
                      {...props}
                      onLogin={({ user, clinic }) => {
                        console.log("✅ User logged in:", user);
                        console.log("🏥 Selected clinic:", clinic);
                        localStorage.setItem('user', JSON.stringify(user));
                        localStorage.setItem('selectedClinic', JSON.stringify(clinic));
                      }}
                    />
                  )}
                />
                
                <Route path="/clinic-select" component={ClinicLogin} />
                <Route path="/unauthorized" component={Unauthorized} />
                
                {/* SIMPLIFIED: Remove userId requirements for now */}
                


                // In your App.js, replace the dashboard route with this:

<Route 
  path="/dashboard" 
  render={() => {
    // Safe parsing function
    const safeParseJSON = (key, fallback) => {
      try {
        const item = localStorage.getItem(key);
        if (item === null || item === 'undefined' || item === 'null') {
          return fallback;
        }
        return JSON.parse(item);
      } catch (error) {
        console.warn(`Failed to parse localStorage key "${key}":`, error);
        return fallback;
      }
    };

    // Get user data safely
    const user = safeParseJSON('user', {});
    const userRoles = safeParseJSON('userRoles', []);
    const selectedClinic = safeParseJSON('selectedClinic', {});
    
    console.log('🔍 Dashboard data check:');
    console.log('user:', user);
    console.log('userRoles:', userRoles);
    console.log('selectedClinic:', selectedClinic);
    
    // Safety check: redirect if no user data
    if (!user.id && !user.username) {
      console.log('❌ No user data found, redirecting to login');
      return <Redirect to="/login" />;
    }
    
    return (
      <Dashboard
        userId={user.id}
        userName={user.name || user.username}
        clinicName={selectedClinic.name || user.clinicName || 'Unknown Clinic'}
        userRoles={userRoles}
        onLogout={() => {
          // Clear storage and redirect to login
          localStorage.clear();
          window.location.href = '/login';
        }}
      />
    );
  }} 
/>                <Route path="/profile" component={Profile} />
                <Route path="/chat" component={Chatbook} />
                <Route path="/calendar" component={Calendar} />
                <Route path="/upload" component={Upload} />
                <Route path="/recorder" component={MedicalAudioTranscriber} />
                <Route path="/fax-dashboard" component={FaxDashboard} />
                
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

/*
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <UIProvider>
            <div className="App-container">
              <Switch>
                <Route exact path="/" render={() => <Redirect to="/dashboard" />} />
                <Route
                  path="/login"
                  render={(props) => (
                    <LoginPage
                      {...props}
                      onLogin={({ user, clinic }) => {
                        console.log("✅ User logged in:", user);
                        console.log("🏥 Selected clinic:", clinic);

                        // ✅ 可选：保存到 localStorage（用于全局读取）
                        localStorage.setItem('user', JSON.stringify(user));
                        localStorage.setItem('selectedClinic', JSON.stringify(clinic));

                        // ✅ 可选：跳转到用户 Dashboard（已在 LoginPage 中跳转过可省略）
                        // props.history.push(`/dashboard/${user.id}`);

                        // ✅ 可选：你也可以调用 Context 方法，如 setUser(user)
                        // 但这取决于你的 AuthContext 的实现
                      }}
                    />
                  )}
                />

                
                
                <Route path="/clinic-select" component={ClinicLogin} />
                <Route path="/unauthorized" component={Unauthorized} />
                
               // { Protected Routes - General Access (any authenticated user) }
                <ProtectedRoute path="/dashboard/:userId" component={Dashboard} />
                <ProtectedRoute path="/profile/:userId" component={Profile} />
                <ProtectedRoute path="/chat" component={Chatbook} />
                <ProtectedRoute path="/calendar" component={Calendar} />
                
              //  {/* Protected Routes - Staff Level and Above }
                <ProtectedRoute 
                  path="/upload/:userId" 
                  component={Upload}
                  roles={['staff', 'doctor', 'moderator', 'admin']}
                />
                
              //  { Protected Routes - Doctor Level and Above }
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
                
              //  {/* Admin Only Routes }
                <ProtectedRoute 
                  path="/admin" 
                  component={() => <div>Admin Dashboard (To be implemented)</div>}
                  roles={['admin']}
                />
                
               // {/* 404 - Must be last/}
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
*/