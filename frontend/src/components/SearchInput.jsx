import React from 'react';

function SearchInput({ value, onChange, placeholder = "Search..." }) {
  return (
    <div style={{ position: 'relative', marginBottom: '1rem', width: '100%', maxWidth: '400px' }}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.5rem 1rem 0.5rem 2.5rem',
          borderRadius: '20px',
          border: '1px solid #ccc',
          fontSize: '1rem',
        }}
      />
      <span style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: '#888'
        }}>
        <i className="fa-solid fa-magnifying-glass"></i>
      </span>
    </div>
  );
}

export default SearchInput;
