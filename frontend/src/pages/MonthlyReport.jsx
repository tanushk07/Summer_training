import React, { useState, useEffect } from "react";
import "../styles/monthlyreport.css";
import {
  buildApiUrl,
  buildApiUrlWithQuery,
  API_ENDPOINTS,
} from "../config/api";

function MonthlyReport() {
  const [sites, setSites] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [statistics, setStatistics] = useState({
    summary: {
      No_of_Working_Days_in_the_Month: 0,
      Total_Employees_in_the_Month: 0,
      No_of_Times_beyond_Time1: 0,
      No_of_Times_beyond_Time2: 0,
    },
  });
  const [latePunchesStats, setLatePunchesStats] = useState({});
  const [filters, setFilters] = useState({
    site: "All Sites",
    fromDate: "",
    toDate: "",
    time1: "07:00",
    time2: "07:15",
    searchTerm: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rowsPerPage = 30;

  // Fetch sites on component mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.MONTHLY_REPORT));
        const response = await res.json();

        if (response.success) {
          setSites(response.data.sites || []);
          setFilters((prev) => ({
            ...prev,
            time1: response.data.time1?.substring(0, 5) || "07:00",
            time2: response.data.time2?.substring(0, 5) || "07:15",
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
        buildApiUrlWithQuery(API_ENDPOINTS.MONTHLY_REPORT, {
          site: filters.site,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          time1: `${filters.time1}:00`,
          time2: `${filters.time2}:00`,
        })
      );
      const response = await res.json();

      console.log("Monthly report response:", response);

      if (response.success) {
        setReportData(response.data.employees || []);
        setStatistics(response.data.statistics || {});
        setLatePunchesStats(response.data.latePunchesStatistics || {});
        setCurrentPage(1);
      } else {
        throw new Error(response.error || "Failed to generate report");
      }
    } catch (err) {
      console.error("Failed to fetch monthly report:", err);
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
  const filteredData = reportData.filter((record) => {
    if (!filters.searchTerm) return true;
    const searchLower = filters.searchTerm.toLowerCase();
    return (
      record.employee_id?.toString().includes(searchLower) ||
      record.full_name?.toLowerCase().includes(searchLower) ||
      record.department_name?.toLowerCase().includes(searchLower)
    );
  });
  const handleDownload = () => {
    const downloadUrl = buildApiUrlWithQuery(
      API_ENDPOINTS.DOWNLOAD_MONTHLY_REPORT,
      {
        site: filters.site,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        time1: `${filters.time1}:00`,
        time2: `${filters.time2}:00`,
        searchTerm: filters.searchTerm,
      }
    );
    
    console.log("Downloading from:", downloadUrl);
    window.open(downloadUrl, "_blank");
  };
  
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

  return (
    <div className="monthly-report-container">
      <h1 className="report-title">Monthly Attendance Report</h1>

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
              <option value="All Sites">All Sites</option>
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

      {/* Statistics Summary Section */}
      {/* Three-Column Layout: Employee Level, Late Punches Profile, and Summary */}
      {reportData.length > 0 && (
        <>
          <div className="three-column-section">
            {/* LEFT: Employee Level Late Punches */}
            <div className="employee-level-section">
              <h3>Employee Level</h3>
              <h3>Late Punches</h3>
              <table className="employee-level-table">
                <thead>
                  <tr>
                    <th>Employee Level</th>
                    <th>Late Punches</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>E9</td>
                    <td>{statistics.levelWise?.E9 || 0}</td>
                  </tr>
                  <tr>
                    <td>E8</td>
                    <td>{statistics.levelWise?.E8 || 0}</td>
                  </tr>
                  <tr>
                    <td>E7</td>
                    <td>{statistics.levelWise?.E7 || 0}</td>
                  </tr>
                  <tr>
                    <td>E6</td>
                    <td>{statistics.levelWise?.E6 || 0}</td>
                  </tr>
                  <tr>
                    <td>E5</td>
                    <td>{statistics.levelWise?.E5 || 0}</td>
                  </tr>
                  <tr>
                    <td>E4</td>
                    <td>{statistics.levelWise?.E4 || 0}</td>
                  </tr>
                  <tr>
                    <td>E3</td>
                    <td>{statistics.levelWise?.E3 || 0}</td>
                  </tr>
                  <tr>
                    <td>E2</td>
                    <td>{statistics.levelWise?.E2 || 0}</td>
                  </tr>
                  <tr>
                    <td>E1</td>
                    <td>{statistics.levelWise?.E1 || 0}</td>
                  </tr>
                  <tr>
                    <td>E0</td>
                    <td>{statistics.levelWise?.E0 || 0}</td>
                  </tr>
                  <tr className="total-row">
                    <td>Total Officers</td>
                    <td>{statistics.totalOfficers || 0}</td>
                  </tr>
                  <tr className="staff-row">
                    <td>Staff</td>
                    <td>{statistics.totalStaff || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* MIDDLE: Late Punches Profile */}
            <div className="late-punches-profile">
              <h3>Late Punches Profile</h3>
              <table className="profile-table">
                <thead>
                  <tr>
                  <th>% of Days in Month</th>
                  
                    <th colSpan={2}>% Employees in Band</th>
                  </tr>
                  <tr className="sub-header">
                    <th></th>
                    <th>Beyond {filters.time1}</th>
                    <th>Beyond {filters.time2}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(latePunchesStats).map(([range, data]) => (
                    <tr key={range}>
                      <td>{range}</td>
                      <td>{data.Beyond10 || 0}</td>
                      <td>{data.Beyond1015 || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Summary */}
            <div className="summary-stats">
              <h3>Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <label>No. of Working Days in the month:</label>
                  <span>
                    {statistics.summary?.No_of_Working_Days_in_the_Month || 0}
                  </span>
                </div>
                <div className="summary-item">
                  <label>Total Employees in the month:</label>
                  <span>
                    {statistics.summary?.Total_Employees_in_the_Month || 0}
                  </span>
                </div>
                <div className="summary-card-header">
                  TOTAL LATE PUNCHES DURING THE MONTH
                </div>
                <div className="summary-item">
                  <label>No. of Times beyond Time1:</label>
                  <span>
                    {statistics.summary?.No_of_Times_beyond_Time1 || 0}
                  </span>
                </div>
                <div className="summary-item">
                  <label>No. of Times beyond Time2:</label>
                  <span>
                    {statistics.summary?.No_of_Times_beyond_Time2 || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          {/* Search Bar with Download Button */}
          <div className="search-download-container">
            <div className="search-box-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Enter ID or Name"
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    searchTerm: e.target.value,
                  }))
                }
                className="search-input-monthly"
              />
            </div>
            <button className="download-btn-monthly" onClick={handleDownload}>Download</button>
          </div>

          {/* Main Data Table */}
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>CPF ID</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Site</th>
                  <th>No. of Days Beyond {filters.time1}</th>
                  <th>Total Time Delay Beyond {filters.time1}</th>
                  <th>No. of Days Beyond {filters.time2}</th>
                  <th>Total Time Delay Beyond {filters.time2}</th>
                  <th>Total EACS Absent Days</th>
                  <th>Total Leave Days</th>
                  <th>Total Days On Tour</th>
                </tr>
              </thead>
              <tbody>
                {console.log(currentData)}
                {currentData.length > 0 ? (
                  currentData.map((record, index) => (
                    <tr key={`${record.employee_id}-${index}`}>
                      <td>{record.employee_id}</td>
                      <td>{record.full_name}</td>
                      <td>{record.designation}</td>
                      <td>{record.department_name}</td>
                      <td>{record.site_name}</td>
                      <td>{record.NoOfDaysBeyond10}</td>
                      <td>{record.TotalTimeDelayBeyond10}</td>
                      <td>{record.NoOfDaysBeyond1015}</td>
                      <td>{record.TotalTimeDelayBeyond1015}</td>
                      <td>{record.TotalEACSAbsentDays}</td>
                      <td>{record.TotalLeaveDays}</td>
                      <td>{record.TotalDaysOnTour}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="12"
                      style={{ textAlign: "center", padding: "2rem" }}
                    >
                      No report data found
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
          <p>Loading monthly report...</p>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          <p>
            Select filters and click "Generate Report" to view monthly
            attendance data
          </p>
        </div>
      )}
    </div>
  );
}

export default MonthlyReport;
