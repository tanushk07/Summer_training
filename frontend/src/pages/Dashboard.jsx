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
  const [filters, setFilters] = useState({
    site: "",
    month: "",
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
        <div
          className="charts-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
            gap: "2rem",
            marginBottom: "3rem",
          }}
        >
          {/* Total Punches Today - Bar Chart */}
          {dashboardData.punchesToday &&
            dashboardData.punchesToday.length > 0 && (
              <div className="chart-card">
                <BarChart
                  labels={dashboardData.punchesToday.map((item) => item.Site)}
                  dataPoints={dashboardData.punchesToday.map(
                    (item) => item.PunchCount
                  )}
                  title="Total Punches Today"
                  backgroundColors={["rgba(75, 192, 192, 0.6)"]}
                />
              </div>
            )}

          {/* Number of Employees Per Site - Pie Chart */}
          {dashboardData.employeesPerSite &&
            dashboardData.employeesPerSite.length > 0 && (
              <div className="chart-card">
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
        </div>

        {/* Bar and Line Charts Side by Side */}
        <div
          className="charts-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "2rem",
            marginTop: "2rem",
          }}
        >
          {/* Leaves vs Absent Days Bar Chart */}
          <div className="chart-card">
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
              <div className="chart-card" style={{ marginTop: "8vh" }}>
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
