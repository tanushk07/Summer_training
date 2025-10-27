import React, { useState, useEffect } from "react";
import "../styles/punching.css";
import {
  buildApiUrl,
  buildApiUrlWithQuery,
  API_ENDPOINTS,
} from "../config/api";

function Punching() {
  const [sites, setSites] = useState([]);
  const [punchingData, setPunchingData] = useState([]);
  const [statistics, setStatistics] = useState({
    lateAfterTime1Count: 0,
    onTimeAfterTime1Count: 0,
    lateAfterTime2Count: 0,
    onTimeAfterTime2Count: 0,
    totalRecords: 0,
  });
  const [filters, setFilters] = useState({
    site: "ALL Sites",
    fromDate: "",
    toDate: "",
    time1: "07:00",
    time2: "07:15",
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
        const res = await fetch(buildApiUrl(API_ENDPOINTS.PUNCHING));
        const response = await res.json();

        if (response.success) {
          setSites(response.data.sites || []);
          setFilters((prev) => ({
            ...prev,
            time1: response.data.filters?.time1?.substring(0, 5) || "07:00",
            time2: response.data.filters?.time2?.substring(0, 5) || "07:15",
          }));
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

    if (!filters.site || !filters.fromDate || !filters.toDate) {
      setError("Please select site, from date, and to date");
      return;
    }

    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      site: filters.site,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      time1: `${filters.time1}:00`,
      time2: `${filters.time2}:00`,
    });

    try {
      const res = await fetch(
        buildApiUrlWithQuery(API_ENDPOINTS.PUNCHING, {
          site: filters.site,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          time1: `${filters.time1}:00`,
          time2: `${filters.time2}:00`,
        })
      );
      const response = await res.json();

      console.log("Punching response:", response);

      if (response.success) {
        setPunchingData(response.data.punchingData || []);
        setStatistics(response.data.statistics || {});
        setCurrentPage(1);
      } else {
        throw new Error(response.error || "Failed to generate report");
      }
    } catch (err) {
      console.error("Failed to fetch punching data:", err);
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
  const filteredData = punchingData.filter((record) => {
    if (!filters.searchTerm) return true;
    const searchLower = filters.searchTerm.toLowerCase();
    return (
      record.ID?.toString().includes(searchLower) ||
      record.Name?.toLowerCase().includes(searchLower) ||
      record.Department?.toLowerCase().includes(searchLower)
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
    const downloadUrl = buildApiUrlWithQuery(API_ENDPOINTS.DOWNLOAD_PUNCHING, {
      site: filters.site,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      time1: `${filters.time1}:00`,
      time2: `${filters.time2}:00`,
      searchTerm: filters.searchTerm || '',

    });

    console.log("Downloading from:", downloadUrl);
    window.open(downloadUrl, "_blank");
  };

  return (
    <div className="punching-container">
      <h1 className="punching-title">Punching Data</h1>

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
              <option value="ALL SITES">All SITES</option>
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
        </div>

        <div className="time-row">
          <div className="time-group">
            <label>Time 1:</label>
            <input
              type="time"
              name="time1"
              value={filters.time1}
              onChange={handleFilterChange}
              className="time-input"
            />
          </div>

          <div className="time-group">
            <label>Time 2:</label>
            <input
              type="time"
              name="time2"
              value={filters.time2}
              onChange={handleFilterChange}
              className="time-input"
            />
          </div>
        </div>

        <button type="submit" className="generate-btn" disabled={loading}>
          {loading ? "Generating..." : "Generate Report"}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}
      {/* Statistics */}
      {statistics.totalRecords > 0 && (
        <div className="statistics-section">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Late After Time 1:</span>
              <span className="stat-value">
                {statistics.lateAfterTime1Count}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">On Time (Time 1):</span>
              <span className="stat-value">
                {statistics.onTimeAfterTime1Count}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Late After Time 2:</span>
              <span className="stat-value">
                {statistics.lateAfterTime2Count}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">On Time (Time 2):</span>
              <span className="stat-value">
                {statistics.onTimeAfterTime2Count}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Search Bar */}
      {punchingData.length > 0 && (
        <>
          <div className="search-container">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Enter ID"
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

          {/* Punching Data Table */}
          <div className="table-container">
            <table className="punching-table">
              <thead>
                <tr>
                  <th>ID ▲ ▼</th>
                  <th>Name ▲ ▼</th>
                  <th>designation ▲ ▼</th>
                  <th>Department ▲ ▼</th>
                  <th>Punch Date & Time ▲ ▼</th>
                  <th>Is Late after Time 1? ▲ ▼</th>
                  <th>Delayed from Time1 ▲ ▼</th>
                  <th>Is Late after Time 2? ▲ ▼</th>
                  <th>Delayed from Time 2 ▲ ▼</th>
                  <th>DOWeek ▲ ▼</th>
                </tr>
              </thead>
              <tbody>
                {currentData.length > 0 ? (
                  currentData.map((record, index) => (
                    <tr key={`${record.ID}-${index}`}>
                      <td>{record.ID}</td>
                      <td>{record.Name}</td>
                      <td>{record.designation || "Jr.Technician"}</td>
                      <td>{record.Department}</td>
                      <td>{record["Punch Date & Time"]}</td>
                      <td>{record["Is Late after Time 1?"]}</td>
                      <td>{record["Delayed from Time1"]}</td>
                      <td>{record["Is Late after Time 2?"]}</td>
                      <td>{record["Delayed from Time 2"]}</td>
                      <td>{record.DOWeek}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="10"
                      style={{ textAlign: "center", padding: "2rem" }}
                    >
                      No punching records found
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
          <p>Loading punching data...</p>
        </div>
      )}

      {!loading && punchingData.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          <p>
            Select filters and click "Generate Report" to view punching data
          </p>
        </div>
      )}
    </div>
  );
}

export default Punching;
