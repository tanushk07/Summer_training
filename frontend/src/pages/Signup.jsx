import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { buildApiUrl, API_ENDPOINTS } from "../config/api";

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    userid: "",
    username: "",
    email: "", // Keep for UI but won't send to backend
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // Map form fields to match new database schema
      const signupData = {
        cpf_no: form.userid, // Map userid to cpf_no
        username: form.username,
        password: form.password,
        // Don't send email - new database doesn't have it
      };

      console.log("Sending signup data:", signupData);

      const res = await fetch(buildApiUrl(API_ENDPOINTS.SIGNUP), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupData),
      });

      const data = await res.json();
      console.log("Signup response:", data);

      if (data.success) {
        setSuccess("Account created successfully! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <img src="/Design 1.png" alt="Logo" style={styles.logo} />
        <h2 style={styles.h2}>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="userid"
            placeholder="CPF NUMBER"
            value={form.userid}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <input
            type="email"
            name="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={handleChange}
            style={styles.input}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
            style={styles.input}
          />
          {error && (
            <p style={{ color: "red", fontSize: "0.9rem", marginTop: "10px" }}>
              {error}
            </p>
          )}
          {success && (
            <p
              style={{ color: "green", fontSize: "0.9rem", marginTop: "10px" }}
            >
              {success}
            </p>
          )}
          <button type="submit" style={styles.submitButton}>
            Sign Up
          </button>
        </form>
        <Link to="/login" style={styles.link}>
          Already have an account? Sign In
        </Link>
      </div>
    </div>
  );
}

const styles = {
  body: {
    fontFamily: "Arial, sans-serif",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    margin: 0,
    backgroundColor: "#ffffff",
    flexDirection: "column",
  },
  container: {
    background: "#fff",
    padding: "40px 30px",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    maxWidth: "450px",
    width: "100%",
  },
  logo: {
    width: "50px",
    height: "auto",
    marginBottom: "20px",
  },
  h2: {
    marginBottom: "20px",
    fontSize: "24px",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "10px",
    margin: "10px 0",
    border: "1px solid #ccc",
    borderRadius: "5px",
    boxSizing: "border-box",
    fontSize: "14px",
  },
  submitButton: {
    width: "100%",
    padding: "10px",
    margin: "20px 0",
    backgroundColor: "#ff4500",
    border: "none",
    borderRadius: "5px",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  link: {
    display: "block",
    margin: "10px 0",
    color: "#007bff",
    textDecoration: "none",
    fontSize: "14px",
  },
};

export default Signup;
