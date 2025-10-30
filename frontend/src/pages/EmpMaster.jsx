import React, { useState, useEffect } from "react";
import "../styles/empmaster.css";
import {
  buildApiUrlWithQuery,
  buildApiUrl,
  API_ENDPOINTS,
} from "../config/api";

function EmpMaster() {
  const [employees, setEmployees] = useState([]);
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({
    site: "",
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const rowsPerPage = 30;

  // Fetch employee data
  useEffect(() => {
    async function fetchEmployees() {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (filters.site) query.append("site", filters.site);

      try {
        const res = await fetch(
          buildApiUrlWithQuery(API_ENDPOINTS.EMP_MASTER, {
            site: filters.site,
          })
        );
        const response = await res.json();

        if (response.success) {
          setEmployees(response.data.employees);
          setSites(response.data.sites);
          setCurrentPage(1); // Reset to first page on filter change
        } else {
          throw new Error(response.error || "Failed to load employees");
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
        setError("Could not load employee data");
      } finally {
        setLoading(false);
      }
    }

    fetchEmployees();
  }, [filters.site]);

  // Handle site filter change
  const handleSiteChange = (e) => {
    setFilters((prev) => ({ ...prev, site: e.target.value }));
    setCurrentPage(1);
  };
  const handleSearchChange = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
    setCurrentPage(1); // Reset to page 1 when searching
  };
  const filteredEmployees = employees.filter((emp) => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      emp.employee_id?.toString().includes(searchLower) ||
      emp.full_name?.toLowerCase().includes(searchLower) ||
      emp.firstname?.toLowerCase().includes(searchLower) ||
      emp.lastname?.toLowerCase().includes(searchLower) ||
      emp.middlename?.toLowerCase().includes(searchLower) ||
      emp.department_name?.toLowerCase().includes(searchLower) ||
      emp.designation_name?.toLowerCase().includes(searchLower)
    );
  });

  // ✅ Pagination on filtered data - same as LeaveInfo
  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };
  // // Handle search input
  // const handleSearchChange = (e) => {
  //   setFilters((prev) => ({ ...prev, search: e.target.value }));
  // };

  // // Pagination logic
  // const totalPages = Math.ceil(employees.length / rowsPerPage);
  // const startIndex = (currentPage - 1) * rowsPerPage;
  // const endIndex = startIndex + rowsPerPage;
  // const currentEmployees = employees.slice(startIndex, endIndex);

  // const goToPrevPage = () => {
  //   if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  // };

  // const goToNextPage = () => {
  //   if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  // };

  // Download CSV function
  // Download Excel function with current filters
  const handleDownload = () => {
    const downloadUrl = buildApiUrlWithQuery(
      API_ENDPOINTS.DOWNLOAD_EMP_MASTER,
      {
        site: filters.site || "",
        searchTerm: filters.search || "",
      }
    );

    console.log("Downloading from:", downloadUrl);
    window.open(downloadUrl, "_blank");
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Loading employee data...</h2>
      </div>
    );
  }

  return (
    <div className="emp-master-container">
      <h1 className="emp-master-title">Employee Data</h1>

      {/* Site Filter */}
      <div className="filter-section">
        <label htmlFor="site-select">Select Site:</label>
        <select
          id="site-select"
          value={filters.site}
          onChange={handleSiteChange}
          className="site-dropdown"
        >
          <option value="All Sites">All Sites</option>
          {sites.map((site) => (
            <option key={site.site_id} value={site.site_name}>
              {site.site_name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setFilters({ site: filters.site, search: "" })}
          className="submit-btn"
        >
          SUBMIT
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-box">
          <i className="fa-solid fa-magnifying-glass search-icon"></i>
          <input
            type="text"
            id="searchID"
            placeholder="Enter ID or Name"
            value={filters.search}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        <button onClick={handleDownload} className="download-btn">
          Download
        </button>
      </div>

      {/* Employee Table */}
      <div className="table-container">
        <table className="emp-table">
          <thead>
            <tr>
              <th>ID ▲ ▼</th>
              <th>Name ▲ ▼</th>
              <th>Designation ▲ ▼</th>
              <th>Department ▲ ▼</th>
            </tr>
          </thead>
          <tbody>
            {console.log(currentEmployees)}
            {currentEmployees.length > 0 ? (
              currentEmployees.map((emp) => (
                <tr key={emp.employee_id}>
                  <td>{emp.employee_id}</td>
                  <td>
                    {emp.full_name ||
                      `${emp.first_name} ${emp.middle_name || ""} ${
                        emp.last_name
                      }`}
                  </td>
                  <td>{emp.designation_name || "N/A"}</td>
                  <td>{emp.department_name || "N/A"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="4"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  No employees found
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
          Page {currentPage} of {totalPages || 1}
        </span>
        <button
          onClick={goToNextPage}
          disabled={currentPage === totalPages || employees.length === 0}
          className={currentPage === totalPages ? "disabled" : ""}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default EmpMaster;
