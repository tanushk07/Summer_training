import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import '../styles/navbar.css';

function Navbar({ user }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Close dropdown when clicking outside
  const handleBlur = (e) => {
    // Check if the click is outside the dropdown
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropdownOpen(false);
    }
  };

  return (
    <div className="navbar">
      <header className="navbar-header">
        <Link to="/" className="logo">
          <img src="/images.png" alt="ONGC Logo" className="logo-img" />
        </Link>
        {user ? (
          <Link to="/logout" className="sign-in-btn">
            Logout
          </Link>
        ) : (
          <Link to="/login" className="sign-in-btn">
            Sign in
          </Link>
        )}
      </header>
      
      {user && (
        <nav className="navbar-nav">
          <ul className="nav-list">
            <li>
              <NavLink 
                to="/" 
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                <i className="fas fa-tachometer-alt"></i> Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/monthlyreport" 
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                <i className="fas fa-calendar-alt"></i> Monthly Report
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/emp_master" 
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                <i className="fas fa-users"></i> Employee Data
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/punching" 
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                <i className="fa-solid fa-table-list"></i> Punch Data
              </NavLink>
            </li>
            <li 
              className="dropdown" 
              onBlur={handleBlur}
              tabIndex={0}
            >
              <span className="dropdown-trigger" onClick={toggleDropdown}>
                <i className="fa-solid fa-caret-down"></i> More
              </span>
              <div className={`dropdown-content ${dropdownOpen ? 'show' : ''}`}>
                <NavLink 
                  to="/leaveinfo" 
                  className="dropdown-link"
                  onClick={() => setDropdownOpen(false)}
                >
                  <i className="fa-solid fa-circle-info"></i> Applied Leaves
                </NavLink>
                <NavLink 
                  to="/tourinfo" 
                  className="dropdown-link"
                  onClick={() => setDropdownOpen(false)}
                >
                  <i className="fa-solid fa-circle-info"></i> Applied Tour Leaves
                </NavLink>
              </div>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

export default Navbar;
