import React, { Component } from "react";
import "./SeverityChart.css";

class SeverityChart extends Component {
  constructor(props) {
    super(props);
    this.chartRef = React.createRef();
  }

  handleBarClick = (severityLevel) => {
    if (this.props.onSeverityClick) {
      this.props.onSeverityClick(severityLevel);
    }
  };

  render() {
    const { data, selectedLevel } = this.props;
    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
      <div className="SeverityChart-container">
        <div className="SeverityChart-chart" ref={this.chartRef}>
          {data.map((item, index) => {
            const height = (item.count / maxCount) * 200; // Max height 200px
            const isSelected = selectedLevel === item.level;
            
            return (
              <div 
                key={item.level}
                className={`SeverityChart-bar ${isSelected ? 'selected' : ''}`}
                onClick={() => this.handleBarClick(item.level)}
                style={{ 
                  animationDelay: `${index * 0.1}s`
                }}
              >
                <div className="bar-container">
                  <div 
                    className="bar-fill"
                    style={{ 
                      height: `${height}px`,
                      backgroundColor: item.color,
                      transition: 'all 0.3s ease'
                    }}
                  />
                  <div className="bar-value">{item.count}</div>
                </div>
                <div className="bar-label">
                  <div className="severity-level">{item.level}</div>
                  <div className="severity-range">({item.range})</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="SeverityChart-legend">
          <h4>Severity Levels</h4>
          {data.map(item => (
            <div 
              key={item.level} 
              className={`legend-item ${selectedLevel === item.level ? 'selected' : ''}`}
              onClick={() => this.handleBarClick(item.level)}
            >
              <div 
                className="legend-color" 
                style={{ backgroundColor: item.color }}
              />
              <span className="legend-text">
                {item.level} ({item.count})
              </span>
            </div>
          ))}
        </div>

        {/* Chart Info */}
        <div className="SeverityChart-info">
          <p>💡 Click on bars to filter the data table</p>
          <div className="chart-stats">
            <span>Total: {data.reduce((sum, item) => sum + item.count, 0)} faxes</span>
            <span>High Risk: {data.filter(item => ['重度', '危急'].includes(item.level)).reduce((sum, item) => sum + item.count, 0)}</span>
          </div>
        </div>
      </div>
    );
  }
}

export default SeverityChart; // ← Fixed: Added semicolon here!