import React, { useState } from 'react';

function LoginForm({ onSubmit }) {
  const [form, setForm] = useState({ userid: '', password: '' });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{
      maxWidth: '400px',
      margin: 'auto',
      background: '#fff',
      padding: '40px 30px',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <img src="/Design 1.png" alt="Logo" style={{ width: '50px', marginBottom: '20px' }} />
      <h2>Sign In</h2>
      <input
        type="text"
        name="userid"
        placeholder="CPF NUMBER"
        value={form.userid}
        onChange={handleChange}
        required
        style={inputStyle}
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        required
        style={inputStyle}
      />
      <button type="submit" style={buttonStyle}>
        Sign In
      </button>
      <a href="/signup" style={{ display: 'block', marginTop: '10px', color: '#007bff', textDecoration: 'none' }}>
        Sign Up
      </a>
      <a href="#" style={{ display: 'block', marginTop: '5px', color: '#007bff', textDecoration: 'none' }}>
        Forgot your password?
      </a>
    </form>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  margin: '10px 0',
  border: '1px solid #ccc',
  borderRadius: '5px',
};

const buttonStyle = {
  width: '100%',
  padding: '10px',
  margin: '20px 0',
  backgroundColor: '#ff4500',
  border: 'none',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '1rem',
  cursor: 'pointer',
};

export default LoginForm;
