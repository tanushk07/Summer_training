import React, { useState } from 'react';

function SignupForm({ onSubmit }) {
  const [form, setForm] = useState({
    userid: '',
    username: '',
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: 'auto', background: '#fff', padding: '40px 30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h2>Sign Up</h2>
      <input
        type="text"
        name="userid"
        placeholder="CPF NO"
        value={form.userid}
        onChange={handleChange}
        required
        style={inputStyle}
      />
      <input
        type="text"
        name="username"
        placeholder="Username"
        value={form.username}
        onChange={handleChange}
        required
        style={inputStyle}
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        value={form.email}
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
        Sign Up
      </button>
    </form>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  margin: '10px 0',
  border: '1px solid #ccc',
  borderRadius: '5px',
  fontSize: '1rem',
};

const buttonStyle = {
  width: '100%',
  padding: '10px',
  margin: '20px 0',
  backgroundColor: '#ff4500',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  fontSize: '1rem',
  cursor: 'pointer',
};

export default SignupForm;
