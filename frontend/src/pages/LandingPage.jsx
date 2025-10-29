import React from "react";
import { Link } from "react-router-dom";
import "../styles/landingpagestyle.css";

function LandingPage() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1>EACS Human Resource Monitoring System</h1>
        <p>Visualize attendance data in a seamless and elegant interface</p>
        <Link to="/login" className="cta-button">
          See Attendance Insights
        </Link>
      </div>
      <div className="hero-image">
        <img src="/QT-ONGC.jpg" alt="ONGC" />
      </div>
    </section>
  );
}

export default LandingPage;
