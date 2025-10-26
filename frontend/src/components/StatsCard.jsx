import React from 'react';

function StatsCard({ title, value }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{value}</p>
    </div>
  );
}

export default StatsCard;
