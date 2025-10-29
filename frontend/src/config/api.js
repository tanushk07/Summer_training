// API Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4444";

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: "/login",
  SIGNUP: "/signup",

  // Dashboard
  DASHBOARD: "/",

  // Employee Management
  EMP_MASTER: "/emp_master",
  EMPLOYEE_DETAILS: "/employee_details",
  // Reports
  MONTHLY_REPORT: "/monthlyreport",
  LEAVE_INFO: "/leaveinfo",
  TOUR_INFO: "/tourinfo",
  PUNCHING: "/punching",

  // Downloads
  DOWNLOAD_EMP_MASTER: "/download/emp_master",
  DOWNLOAD_PUNCHING: "/download/punching",
  DOWNLOAD_TOUR_INFO: "/download/tourinfo",
  DOWNLOAD_LEAVE_INFO: "/download/leaveinfo",
  DOWNLOAD_MONTHLY_REPORT: "/download/monthlyreport",
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function to build API URL with query parameters
export const buildApiUrlWithQuery = (endpoint, queryParams) => {
  const url = buildApiUrl(endpoint);
  if (queryParams) {
    const query = new URLSearchParams(queryParams).toString();
    return `${url}?${query}`;
  }
  return url;
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  buildApiUrl,
  buildApiUrlWithQuery,
};
