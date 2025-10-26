import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../App";
import { buildApiUrl, API_ENDPOINTS } from "../config/api";

function Login() {
  const navigate = useNavigate();
  const { login } = useContext(UserContext);
  const [form, setForm] = useState({ userid: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("Sending login request:", { userid: form.userid });

      const res = await fetch(buildApiUrl(API_ENDPOINTS.LOGIN), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include", // Important for sessions
      });

      const data = await res.json();
      console.log("Login response:", data);

      if (data.success && data.user) {
        // Use context login function to store user
        login(data.user);
        navigate("/");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <img src="/Design 1.png" alt="Logo" style={styles.logo} />
        <h2 style={styles.h2}>Sign In</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="userid"
            placeholder="CPF NUMBER"
            value={form.userid}
            onChange={handleChange}
            required
            style={styles.input}
            disabled={loading}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={styles.input}
            disabled={loading}
          />
          {error && (
            <p
              style={{
                color: "red",
                fontSize: "0.9rem",
                marginTop: "10px",
                padding: "10px",
                backgroundColor: "#ffebee",
                borderRadius: "5px",
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
        <Link to="/signup" style={styles.link}>
          Don't have an account? Sign Up
        </Link>
        {/* <Link to="#" style={styles.link}>
          Forgot your password?
        </Link> */}
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
    backgroundColor: "#fffff",
    flexDirection: "column",
  },
  container: {
    marginBottom: "5vw",
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

export default Login;
