import React, { Component } from "react";
import "./FaxTable.css";

class FaxTable extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sortField: 'processedAt',
      sortDirection: 'desc',
      currentPage: 1,
      itemsPerPage: 10,
      searchTerm: ''
    };
  }

  handleSort = (field) => {
    const direction = this.state.sortField === field && this.state.sortDirection === 'asc' 
      ? 'desc' 
      : 'asc';
    
    this.setState({
      sortField: field,
      sortDirection: direction
    });
  };

  handleRowClick = (fax) => {
    if (this.props.onFaxSelect) {
      this.props.onFaxSelect(fax);
    }
  };

  getSeverityBadge = (severityLevel, severityScore) => {
    const severityConfig = {
      '轻度': { class: 'mild', icon: '🟢' },
      '中度': { class: 'moderate', icon: '🟡' },
      '重度': { class: 'severe', icon: '🟠' },
      '危急': { class: 'critical', icon: '🔴' }
    };

    const config = severityConfig[severityLevel] || severityConfig['轻度'];
    
    return (
      <span className={`severity-badge ${config.class}`}>
        {config.icon} {severityLevel} ({severityScore})
      </span>
    );
  };

  formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  getSortedAndFilteredData = () => {
    let filteredData = this.props.data;

    // Apply search filter
    if (this.state.searchTerm) {
      const searchLower = this.state.searchTerm.toLowerCase();
      filteredData = filteredData.filter(fax => 
        fax.fileName.toLowerCase().includes(searchLower) ||
        fax.severityReason.toLowerCase().includes(searchLower) ||
        fax.summary.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filteredData.sort((a, b) => {
      let aVal = a[this.state.sortField];
      let bVal = b[this.state.sortField];

      if (this.state.sortField === 'processedAt') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return this.state.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.state.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredData;
  };

  getPaginatedData = () => {
    const sortedData = this.getSortedAndFilteredData();
    const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
    return sortedData.slice(startIndex, startIndex + this.state.itemsPerPage);
  };

  getTotalPages = () => {
    return Math.ceil(this.getSortedAndFilteredData().length / this.state.itemsPerPage);
  };

  render() {
    const paginatedData = this.getPaginatedData();
    const totalPages = this.getTotalPages();
    const totalItems = this.getSortedAndFilteredData().length;

    return (
      <div className="FaxTable-container">
        {/* Search and Controls */}
        <div className="FaxTable-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search files, reasons, or summaries..."
              value={this.state.searchTerm}
              onChange={(e) => this.setState({ searchTerm: e.target.value, currentPage: 1 })}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          <div className="table-info">
            Showing {paginatedData.length} of {totalItems} records
          </div>
        </div>

        {/* Table */}
        <div className="FaxTable-wrapper">
          <table className="FaxTable-table">
            <thead>
              <tr>
                <th 
                  onClick={() => this.handleSort('fileName')}
                  className={`sortable ${this.state.sortField === 'fileName' ? this.state.sortDirection : ''}`}
                >
                  File Name
                  <span className="sort-indicator">
                    {this.state.sortField === 'fileName' && (
                      this.state.sortDirection === 'asc' ? '↑' : '↓'
                    )}
                  </span>
                </th>
                <th 
                  onClick={() => this.handleSort('processedAt')}
                  className={`sortable ${this.state.sortField === 'processedAt' ? this.state.sortDirection : ''}`}
                >
                  Processed At
                  <span className="sort-indicator">
                    {this.state.sortField === 'processedAt' && (
                      this.state.sortDirection === 'asc' ? '↑' : '↓'
                    )}
                  </span>
                </th>
                <th 
                  onClick={() => this.handleSort('severityScore')}
                  className={`sortable ${this.state.sortField === 'severityScore' ? this.state.sortDirection : ''}`}
                >
                  Severity
                  <span className="sort-indicator">
                    {this.state.sortField === 'severityScore' && (
                      this.state.sortDirection === 'asc' ? '↑' : '↓'
                    )}
                  </span>
                </th>
                <th>Reason</th>
                <th>Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((fax, index) => (
                <tr 
                  key={fax._id || index}
                  className={`table-row ${this.props.selectedFax?._id === fax._id ? 'selected' : ''}`}
                  onClick={() => this.handleRowClick(fax)}
                >
                  <td className="file-name">
                    <div className="file-info">
                      <span className="file-icon">📄</span>
                      <span className="file-text">{fax.fileName}</span>
                    </div>
                  </td>
                  <td className="processed-time">
                    {this.formatDate(fax.processedAt)}
                  </td>
                  <td className="severity-cell">
                    {this.getSeverityBadge(fax.severityLevel, fax.severityScore)}
                  </td>
                  <td className="reason-cell">
                    <div className="reason-text" title={fax.severityReason}>
                      {fax.severityReason.length > 50 
                        ? fax.severityReason.substring(0, 50) + '...'
                        : fax.severityReason
                      }
                    </div>
                  </td>
                  <td className="summary-cell">
                    <div className="summary-text" title={fax.summary}>
                      {fax.summary.length > 60 
                        ? fax.summary.substring(0, 60) + '...'
                        : fax.summary
                      }
                    </div>
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="action-btn view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        this.handleRowClick(fax);
                      }}
                    >
                      👁️
                    </button>
                    {fax.severityScore >= 7 && (
                      <button 
                        className="action-btn alert-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle alert action
                        }}
                        title="Send Alert"
                      >
                        🚨
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="FaxTable-pagination">
            <button 
              disabled={this.state.currentPage === 1}
              onClick={() => this.setState({ currentPage: this.state.currentPage - 1 })}
              className="pagination-btn"
            >
              Previous
            </button>
            
            <span className="pagination-info">
              Page {this.state.currentPage} of {totalPages}
            </span>
            
            <button 
              disabled={this.state.currentPage === totalPages}
              onClick={() => this.setState({ currentPage: this.state.currentPage + 1 })}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        )}

        {paginatedData.length === 0 && (
          <div className="FaxTable-empty">
            <div className="empty-icon">📭</div>
            <h3>No fax records found</h3>
            <p>
              {this.state.searchTerm 
                ? 'Try adjusting your search terms'
                : 'Fax records will appear here once processing begins'
              }
            </p>
          </div>
        )}
      </div>
    );
  }
}

export default FaxTable;