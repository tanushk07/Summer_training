import React, { useState, useEffect } from "react";
import "../styles/leaveinfo.css";
import {
  buildApiUrl,
  buildApiUrlWithQuery,
  API_ENDPOINTS,
} from "../config/api";

function LeaveInfo() {
  const [sites, setSites] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [statistics, setStatistics] = useState({
    totalLeaves: 0,
    approvedLeaves: 0,
    pendingLeaves: 0,
  });
  const [filters, setFilters] = useState({
    site: "",
    fromDate: "",
    toDate: "",
    holidays: "",
    searchTerm: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rowsPerPage = 10;

  // Fetch sites on component mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.LEAVE_INFO));
        const response = await res.json();

        if (response.success) {
          setSites(response.data.sites || []);
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      }
    }
    fetchInitialData();
  }, []);

  // Generate report
  const handleGenerateReport = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      site: filters.site || "",
      fromDate: filters.fromDate || "",
      toDate: filters.toDate || "",
      holidays: filters.holidays || "",
    });

    try {
      const res = await fetch(
        buildApiUrlWithQuery(API_ENDPOINTS.LEAVE_INFO, {
          site: filters.site || "",
          fromDate: filters.fromDate || "",
          toDate: filters.toDate || "",
          holidays: filters.holidays || "",
        })
      );
      const response = await res.json();

      console.log("Leave info response:", response);

      if (response.success) {
        setLeaveData(response.data.leaveInfo || []);
        setStatistics(response.data.statistics || {});
        setCurrentPage(1);
      } else {
        throw new Error(response.error || "Failed to generate report");
      }
    } catch (err) {
      console.error("Failed to fetch leave data:", err);
      setError("Could not generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Search filter
  const filteredData = leaveData.filter((record) => {
    if (!filters.searchTerm) return true;
    const searchLower = filters.searchTerm.toLowerCase();
    return (
      record.employee_id?.toString().includes(searchLower) ||
      record.employee_name?.toLowerCase().includes(searchLower) ||
      record.department_name?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  // Download function
  const handleDownload = () => {
    window.open(buildApiUrl(API_ENDPOINTS.DOWNLOAD_LEAVE_INFO), "_blank");
  };

  return (
    <div className="leaveinfo-container">
      <h1 className="leaveinfo-title">Applied Casual Leaves Information</h1>

      {/* Filter Form */}
      <form onSubmit={handleGenerateReport} className="filter-form">
        <div className="filter-row">
          <div className="filter-group">
            <label>Select Site:</label>
            <select
              name="site"
              value={filters.site}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Sites</option>
              {sites.map((site) => (
                <option key={site.site_id} value={site.site_name}>
                  {site.site_name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>From Date:</label>
            <input
              type="date"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>To Date:</label>
            <input
              type="date"
              name="toDate"
              value={filters.toDate}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Holidays (comma-separated dates):</label>
            <input
              type="text"
              name="holidays"
              value={filters.holidays}
              onChange={handleFilterChange}
              placeholder="2024-01-26,2024-08-15"
              className="filter-input"
            />
          </div>
        </div>

        <button type="submit" className="generate-btn" disabled={loading}>
          {loading ? "Generating..." : "Generate Report"}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {/* Statistics Cards */}
      {leaveData.length > 0 && (
        <div className="stats-section">
          <div className="stat-card">
            <span className="stat-label">Total Leaves:</span>
            <span className="stat-value">{statistics.totalLeaves}</span>
          </div>
          <div className="stat-card approved">
            <span className="stat-label">Approved:</span>
            <span className="stat-value">{statistics.approvedLeaves}</span>
          </div>
          <div className="stat-card pending">
            <span className="stat-label">Pending:</span>
            <span className="stat-value">{statistics.pendingLeaves}</span>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {leaveData.length > 0 && (
        <>
          <div className="search-container">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search by ID or Name"
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    searchTerm: e.target.value,
                  }))
                }
                className="search-input"
              />
            </div>
            <button onClick={handleDownload} className="download-btn">
              Download
            </button>
          </div>

          {/* Leave Data Table */}
          <div className="table-container">
            <table className="leave-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Site</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Total Days</th>
                  <th>Adjusted Days</th>
                  <th>Status</th>
                  <th>Holidays</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {currentData.length > 0 ? (
                  currentData.map((record, index) => (
                    <tr key={`${record.leave_id}-${index}`}>
                      <td>{record.employee_id}</td>
                      <td>{record.employee_name}</td>
                      <td>{record.department_name || "N/A"}</td>
                      <td>{record.site_name || "N/A"}</td>
                      <td>{record.begda}</td>
                      <td>{record.endda}</td>
                      <td>{record.total_leave_days}</td>
                      <td>{record.adjusted_total_leave_days}</td>
                      <td>
                        <span
                          className={`status-badge ${record.status?.toLowerCase()}`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td>{record.holidays || "-"}</td>
                      <td>{record.reason || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="11"
                      style={{ textAlign: "center", padding: "2rem" }}
                    >
                      No leave records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className={currentPage === 1 ? "disabled" : ""}
            >
              Previous
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages || 1} ({filteredData.length}{" "}
              records)
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages || filteredData.length === 0}
              className={currentPage === totalPages ? "disabled" : ""}
            >
              Next
            </button>
          </div>
        </>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Loading leave information...</p>
        </div>
      )}

      {!loading && leaveData.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          <p>Select filters and click "Generate Report" to view leave data</p>
        </div>
      )}
    </div>
  );
}

export default LeaveInfo;
