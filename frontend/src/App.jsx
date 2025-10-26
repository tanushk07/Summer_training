import React, { useState, useEffect, createContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Import your pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import EmpMaster from "./pages/EmpMaster";
import LeaveInfo from "./pages/LeaveInfo";
import MonthlyReport from "./pages/MonthlyReport";
import Punching from "./pages/Punching";
import TourInfo from "./pages/TourInfo";
import LandingPage from "./pages/LandingPage";

// Create context for user authentication
export const UserContext = createContext();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  // Check if user is logged in on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    // Check for both null AND the string "undefined"
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Verify it's actually an object with data
        if (parsedUser && typeof parsedUser === "object") {
          setUser(parsedUser);
        } else {
          // Clean up invalid data
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        // Clean up corrupted data
        localStorage.removeItem("user");
      }
    }

    setLoading(false);
  }, []);

  // Function to handle login
  // Function to handle login
  const login = (userData) => {
    if (
      userData &&
      typeof userData === "object" &&
      Object.keys(userData).length > 0
    ) {
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    } else {
      console.error("Invalid user data provided to login function:", userData);
    }
  };

  // Function to handle logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading...</div>
    );
  }

  return (
    
    <UserContext.Provider value={{ user, login, logout }}>
      <Navbar user={user} />
      <main
        style={{ minHeight: "80vh", padding: "1rem 2rem", marginTop: "5vh" }}
      >
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={!user ? <Login /> : <Navigate to="/" />}
          />
          <Route
            path="/signup"
            element={!user ? <Signup /> : <Navigate to="/" />}
          />

          {/* Protected routes */}
          <Route path="/" element={user ? <Dashboard /> : <LandingPage />} />
          <Route
            path="/emp_master"
            element={user ? <EmpMaster /> : <Navigate to="/login" />}
          />
          <Route
            path="/leaveinfo"
            element={user ? <LeaveInfo /> : <Navigate to="/login" />}
          />
          <Route
            path="/monthlyreport"
            element={user ? <MonthlyReport /> : <Navigate to="/login" />}
          />
          <Route
            path="/punching"
            element={user ? <Punching /> : <Navigate to="/login" />}
          />
          <Route
            path="/tourinfo"
            element={user ? <TourInfo /> : <Navigate to="/login" />}
          />

          {/* Logout route */}
          <Route path="/logout" element={<LogoutHandler />} />
        </Routes>
      </main>
      <Footer />
    </UserContext.Provider>
  );
}

// Logout handler component
function LogoutHandler() {
  const { logout } = React.useContext(UserContext);

  React.useEffect(() => {
    logout();
    window.location.href = "/login";
  }, [logout]);

  return null;
}

export default App;
