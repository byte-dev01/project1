import React from "react";
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';

// Pages - Fixed imports to match usage
import LoginPage from "./pages/LoginPage3"; // Make sure this component exists
import Dashboard from "./pages/GeneralDashboard";
import FaxDashboardWrapper from "./pages/FaxDashboardWrapper";
import Upload from "./pages/Upload";
import Chatbook from "./pages/Chatbook";
import MedicalAudioTranscriber from "./pages/Recorder3";
import Profile from "./pages/Profile";
import NotFound from "./modules/NotFound";
import Unauthorized from "./modules/Unauthorized";
import Calendar from "./pages/Calendar";
import AlertDashboard from "./pages/MedDashboard1"; // This was missing!
import ChatbookWrapper from "./pages/ChatbookWrapper"; // NEW

import "../utilities.css";
import "./App.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Switch>
          {/* Public routes */}
          <Route exact path="/login" component={LoginPage} /> {/* Fixed: was Login, should be LoginPage */}
          
          {/* Default redirect */}
          <Route exact path="/" render={() => <Redirect to="/dashboard" />} />
          
          {/* Protected routes - no role restrictions */}
          <ProtectedRoute exact path="/dashboard" component={Dashboard} />
          <ProtectedRoute path="/chat" component={ChatbookWrapper} />
          <ProtectedRoute path="/profile/:userId" component={Profile} />
          <ProtectedRoute path="/calendar" component={Calendar} />
          
          {/* Role-based protected routes */}
          <ProtectedRoute 
            path="/upload/:userId" 
            component={Upload} 
            roles={['staff', 'doctor', 'moderator', 'admin']}
          />
          
          <ProtectedRoute 
            path="/recorder/:userId" 
            component={MedicalAudioTranscriber} 
            roles={['doctor', 'admin', 'moderator']}
          />
          
          <ProtectedRoute 
            path="/fax-dashboard" 
            component={FaxDashboardWrapper} 
            roles={['doctor', 'admin', 'moderator']}
          />
          
          <ProtectedRoute 
            path="/medical-management" 
            component={AlertDashboard} 
            roles={['doctor', 'admin', 'moderator']}
          />
          
          {/* Admin routes */}
          <ProtectedRoute 
            path="/admin" 
            component={() => <div>Admin Dashboard (To be implemented)</div>}
            roles={['admin']}
          />
          
          {/* Error routes */}
          <Route path="/unauthorized" component={Unauthorized} />
          <Route component={NotFound} />
        </Switch>
      </AuthProvider>
    </Router>
  );
}

export default App;