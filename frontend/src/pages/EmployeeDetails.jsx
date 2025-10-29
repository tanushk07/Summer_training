import React, { useState } from "react";
import LineChart from "../components/Charts/LineChart";
import BarChart from "../components/Charts/BarChart";
import PieChart from "../components/Charts/PieChart";
import StatsCard from "../components/StatsCard";
import "../styles/EmployeeDetails.css";
import { buildApiUrl, buildApiUrlWithQuery, API_ENDPOINTS } from "../config/api";


function EmployeeDetails() {
  const [employeeId, setEmployeeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employeeData, setEmployeeData] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!employeeId) {
      setError("Please enter an employee ID");
      return;
    }

    setLoading(true);
    setError("");
    setEmployeeData(null);

    try {
      const query = new URLSearchParams();
      if (fromDate) query.append("fromDate", fromDate);
      if (toDate) query.append("toDate", toDate);

      const endpoint = `${API_ENDPOINTS.EMPLOYEE_DETAILS}/${encodeURIComponent(
        employeeId
      )}`;
      const url = buildApiUrlWithQuery(endpoint, {
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      });

      const res = await fetch(url, { credentials: "include" });

      // Defensive: ensure JSON
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          "Expected JSON but received non-JSON response. Check API base URL or proxy. Details: " +
            text.slice(0, 200)
        );
      }

      const data = await res.json();

      if (data.success) {
        setEmployeeData(data.data);
      } else {
        setError(data.error || "Failed to fetch employee details");
      }
    } catch (err) {
      setError("An error occurred while fetching employee details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmployeeId("");
    setFromDate("");
    setToDate("");
    setEmployeeData(null);
    setError("");
  };

  return (
    <div className="employee-details-container">
      <h1>Employee Details</h1>

      {/* Search Form */}
      <form className="search-form" onSubmit={handleSearch}>
        <div className="form-group">
          <label htmlFor="employeeId">Employee ID *</label>
          <input
            type="text"
            id="employeeId"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="Enter Employee ID"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="fromDate">From Date</label>
          <input
            type="date"
            id="fromDate"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="toDate">To Date</label>
          <input
            type="date"
            id="toDate"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-search" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
          <button type="button" className="btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {/* Employee Data Display */}
      {employeeData && (
        <div className="employee-data">
          {/* Employee Info Card */}
          <div className="employee-info-card">
            <h2>Employee Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Name:</span>
                <span className="value">{employeeData.employee.full_name}</span>
              </div>
              <div className="info-item">
                <span className="label">Employee ID:</span>
                <span className="value">
                  {employeeData.employee.employee_id}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Department:</span>
                <span className="value">
                  {employeeData.employee.department_name}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Designation:</span>
                <span className="value">
                  {employeeData.employee.designation_name}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Site:</span>
                <span className="value">{employeeData.employee.site_name}</span>
              </div>
              <div className="info-item">
                <span className="label">Status:</span>
                <span
                  className={`value status-${
                    employeeData.employee.is_active ? "active" : "inactive"
                  }`}
                >
                  {employeeData.employee.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <p className="date-range">
              Showing data from{" "}
              <strong>{employeeData.dateRange.fromDate}</strong> to{" "}
              <strong>{employeeData.dateRange.toDate}</strong>
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="stats-grid">
            <StatsCard
              title="Total Attendance Days"
              value={employeeData.statistics.total_attendance_days || 0}
            />
            <StatsCard
              title="Casual Leaves Taken"
              value={employeeData.statistics.total_casual_leaves || 0}
            />
            <StatsCard
              title="Tour Leaves Taken"
              value={employeeData.statistics.total_tour_leaves || 0}
            />
            <StatsCard
              title="Avg Late Minutes"
              value={Math.round(employeeData.statistics.avg_late_minutes || 0)}
            />
          </div>

          {/* Charts */}
          <div className="charts-container">
            {/* Attendance Trend Line Chart */}
            <div className="chart-box">
              <h3>Monthly Attendance Trend</h3>
              <LineChart
                labels={employeeData.attendanceTrend.map((item) => item.month)}
                dataPoints={employeeData.attendanceTrend.map(
                  (item) => item.attendance_days
                )}
                title="Attendance Days per Month"
              />
            </div>

            {/* Punctuality Pie Chart */}
            <div className="chart-box">
              <h3>Punctuality Distribution</h3>
              <PieChart
                labels={employeeData.punctualityStats.map(
                  (item) => item.punctuality_status
                )}
                dataPoints={employeeData.punctualityStats.map(
                  (item) => item.count
                )}
                title="On Time vs Late"
                backgroundColors={["#4caf50", "#ff9800", "#f44336"]}
              />
            </div>

            {/* Leave Summary Bar Chart */}
            <div className="chart-box">
              <h3>Leave Summary</h3>
              <BarChart
                labels={employeeData.leaveSummary.map(
                  (item) => item.leave_type
                )}
                dataPoints={employeeData.leaveSummary.map((item) => item.count)}
                title="Casual vs Tour Leaves"
                backgroundColors={["#2196F3", "#9C27B0"]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeDetails;
