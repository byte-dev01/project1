import React, { Component } from "react";
import "./StatCard.css";

class StatCard extends Component {
  render() {
    const { title, value, icon, trend, isAlert } = this.props;

    return (
      <div className={`StatCard-container ${isAlert ? 'alert' : ''}`}>
        <div className="StatCard-header">
          <div className="stat-icon">{icon}</div>
          {isAlert && <div className="alert-indicator">🚨</div>}
        </div>
        
        <div className="StatCard-content">
          <div className="stat-value">{value}</div>
          <div className="stat-title">{title}</div>
        </div>
        
        {trend && (
          <div className="StatCard-trend">
            <span className={`trend-value ${trend.startsWith('+') ? 'positive' : trend.startsWith('-') ? 'negative' : 'neutral'}`}>
              {trend}
            </span>
          </div>
        )}
      </div>
    );
  }
}

export default StatCard;
