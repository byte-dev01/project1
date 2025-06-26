import React, { Component } from "react";
import {
  BrowserRouter as Router,
  Switch, 
  Route,
} from "react-router-dom";

import NavBar from "./modules/NavBar.js";
import Feed from "./pages/Feed.js";
import NotFound from "./pages/NotFound.js";
import Profile from "./pages/Profile.js";
import FaxDashboard from "./pages/FaxDashboard.js";
console.log("🧪 FaxDashboard type:", typeof FaxDashboard);

import Upload from "./pages/Upload.js";
import Chatbook from "./pages/Chatbook.js";
import MedicalAudioTranscriber from "./pages/Recorder.js";

console.log("🔍 All component imports:", {
  NavBar,
  Feed,
  NotFound,
  Profile,
  FaxDashboard,
  Upload,
  Chatbook,
  MedicalAudioTranscriber
});

import { socket } from "../client-socket.js";
import { get, post } from "../utilities";

import "../utilities.css";
import "./App.css";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userId: undefined,
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

  render() {
    return (
      <Router>
        <NavBar
          handleLogin={this.handleLogin}
          handleLogout={this.handleLogout}
          userId={this.state.userId}
        />
        <div className="App-container">
          <Switch> {/* ← Changed from Routes to Switch */}
            <Route exact path="/" render={() => <Feed userId={this.state.userId} />} />
            <Route path="/profile/:userId" component={Profile} />
            <Route path="/chat" render={() => <Chatbook userId={this.state.userId} />} />
            <Route path="/upload/:userId" render={() => <Upload userId={this.state.userId} />} />
            <Route path="/recorder/:userId" render={() => <MedicalAudioTranscriber userId={this.state.userId} />} />
            <Route path="/fax-dashboard" render={() => <FaxDashboard userId={this.state.userId} />} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </Router>
    );
  }
}

export default App;