import React, { useState, useEffect, useContext } from "react";
import { UserContext } from "../App";
import StatsCard from "../components/StatsCard";
import FilterForm from "../components/FilterForm";
import LineChart from "../components/Charts/LineChart";
import BarChart from "../components/Charts/BarChart";
import PieChart from "../components/Charts/PieChart";
import { buildApiUrlWithQuery, API_ENDPOINTS } from "../config/api";
function Dashboard() {
  const { user } = useContext(UserContext);
  const currmonth = new Date().toISOString().slice(0, 7);
  const [filters, setFilters] = useState({
    site: "",
    month: currmonth,
  });
  const [sites, setSites] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    totalSites: 0,
    absenteeTrends: [],
    statistics: {
      totalLeaveDays: 0,
      totalTourDays: 0,
      totalAbsentDays: 0,
    },
    monthlyEmployeeCounts: [],
    punchesToday: [], // ✅ NEW
    employeesPerSite: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dashboard data whenever filters change
  useEffect(() => {
    const abortController = new AbortController();
    async function fetchDashboardData() {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (filters.site) query.append("site", filters.site);
      if (filters.month) query.append("month", filters.month);

      try {
        const res = await fetch(
          buildApiUrlWithQuery(API_ENDPOINTS.DASHBOARD, {
            site: filters.site,
            month: filters.month,
          }),
          { signal: abortController.signal }
        );
        if (abortController.signal.aborted) {
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch dashboard data");

        const response = await res.json();
        console.log("Dashboard response:", response);
        if (abortController.signal.aborted) {
          return;
        }
        if (response.success && response.data) {
          setDashboardData(response.data);

          // Extract sites from the response
          if (response.data.sites && Array.isArray(response.data.sites)) {
            setSites(response.data.sites);
          }
        } else {
          throw new Error(response.message || "Failed to load dashboard data");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch dashboard data:", err);
        setError("Could not load dashboard data. Please try again.");
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDashboardData();
    return () => {
      abortController.abort();
    };
  }, [filters]);
  useEffect(() => {
    setError(null);
    setLoading(true);
  }, []);
  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem 4rem" }}>
      <h1
        style={{
          fontSize: "2.5rem",
          fontFamily: "Montserrat, sans-serif",
          marginBottom: "2rem",
          color: "#333",
        }}
      >
        Dashboard
      </h1>

      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#ffebee",
            color: "#c62828",
            borderRadius: "4px",
            marginBottom: "2rem",
          }}
        >
          {error}
        </div>
      )}
      {/* Filter Form */}
      <FilterForm
        filters={[
          {
            label: "Select Site:",
            name: "site",
            type: "select",
            options: [
              { value: "", label: "All Sites" },
              ...sites.map((site) => ({
                value: site.site_name,
                label: site.site_name,
              })),
            ],
            value: filters.site,
          },
          {
            label: "Select Month:",
            name: "month",
            type: "month",
            value: filters.month,
          },
        ]}
        onChange={handleFilterChange}
        onSubmit={() => {}}
      />
      {/* Stats Grid */}
      <div
        className="summarygrid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2rem",
          marginBottom: "2rem",
        }}
      >
        <StatsCard
          title="Total Employees"
          value={dashboardData.totalEmployees}
        />
        <StatsCard title="Total Sites" value={dashboardData.totalSites} />
        <StatsCard
          title="Total Leave Days"
          value={dashboardData.statistics.totalLeaveDays}
        />
        <StatsCard
          title="Total Tour Days"
          value={dashboardData.statistics.totalTourDays}
        />
        <StatsCard
          title="Total Absents"
          value={dashboardData.statistics.totalAbsentDays}
        />
      </div>

      {/* Charts Section */}
      <div style={{ marginTop: "3rem" }}>
  {/* First Row: Pie Chart and Bar Chart */}
  <div
    className="charts-grid"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
      gap: "2rem",
      marginBottom: "3rem",
    }}
  >
    {/* Number of Employees Per Site - Pie Chart */}
    {dashboardData.employeesPerSite &&
      dashboardData.employeesPerSite.length > 0 && (
        <div
          className="chart-card"
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: "10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            minHeight: "450px", // ✅ Fixed height
            display: "flex",
            flexDirection: "column",
          }}
        >
          <PieChart
            labels={dashboardData.employeesPerSite.map(
              (item) => `${item.Site} (${item.EmployeeCount})`
            )}
            dataPoints={dashboardData.employeesPerSite.map(
              (item) => item.EmployeeCount
            )}
            title="Number Of Employees Per Site"
          />
        </div>
      )}

    {/* Today's Check-ins by Site */}
    <div
      className="chart-box"
      style={{
        background: "#fff",
        padding: "1.5rem",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        minHeight: "450px", // ✅ Fixed height
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h3
        style={{
          marginBottom: "1rem",
          color: "#333",
          fontSize: "1.3rem",
        }}
      >
        Today's Check-ins by Site
      </h3>
      <div style={{ flex: 1 }}>
        <BarChart
          labels={
            dashboardData.punchesToday?.map((item) => item.Site) || []
          }
          dataPoints={
            dashboardData.punchesToday?.map((item) => item.PunchCount) || []
          }
          title="Real-time Attendance"
          backgroundColors={[
            "#2196F3",
            "#4CAF50",
            "#FF9800",
            "#F44336",
            "#9C27B0",
          ]}
        />
      </div>
      {/* Total count below chart */}
      <p
        style={{
          textAlign: "center",
          marginTop: "1rem",
          color: "#666",
          fontSize: "0.95rem",
          fontWeight: "500",
        }}
      >
        Total Today:{" "}
        <strong style={{ color: "#2196F3", fontSize: "1.1rem" }}>
          {dashboardData.punchesToday?.reduce(
            (sum, item) => sum + item.PunchCount,
            0
          ) || 0}
        </strong>{" "}
        punches
      </p>
    </div>
  </div>

  {/* Second Row: Bar Chart and Line Chart */}
  <div
    className="charts-grid"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
      gap: "2rem",
      marginTop: "2rem",
    }}
  >
    {/* Leaves vs Absent Days Bar Chart */}
    <div
      className="chart-card"
      style={{
        background: "#fff",
        padding: "1.5rem",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        minHeight: "450px", // ✅ Fixed height
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <BarChart
        labels={["Applied Leaves & Tours", "Absent Days"]}
        dataPoints={[
          dashboardData.statistics.totalLeaveDays +
            dashboardData.statistics.totalTourDays,
          dashboardData.statistics.totalAbsentDays,
        ]}
        title="Leaves vs Absent Days"
        backgroundColors={["#4caf50", "#f44336"]}
      />
    </div>

    {/* Monthly Employee Counts Line Chart */}
    {dashboardData.monthlyEmployeeCounts &&
      dashboardData.monthlyEmployeeCounts.length > 0 && (
        <div
          className="chart-card"
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: "10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            minHeight: "450px", // ✅ Fixed height
            display: "flex",
            flexDirection: "column",
          }}
        >
          <LineChart
            labels={dashboardData.monthlyEmployeeCounts.map(
              (item) => item.Month
            )}
            dataPoints={dashboardData.monthlyEmployeeCounts.map(
              (item) => item.EmployeeCount
            )}
            title="Monthly Active Employees"
          />
        </div>
      )}
  </div>
</div>

    </div>
  );
}

export default Dashboard;
