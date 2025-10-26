import React from 'react';

function FilterForm({ filters, onChange, onSubmit }) {
  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}
    >
      {filters.map((filter, index) => (
        <div key={index} style={{ flex: '1 1 200px' }}>
          <label 
            htmlFor={filter.name}
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {filter.label}
          </label>
          
          {filter.type === 'select' ? (
            <select
              id={filter.name}
              name={filter.name}
              value={filter.value || ''}
              onChange={onChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '0.9rem'
              }}
            >
              {filter.options && filter.options.map((option, optIndex) => (
                <option 
                  key={optIndex} 
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={filter.name}
              type={filter.type}
              name={filter.name}
              value={filter.value || ''}
              onChange={onChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '0.9rem'
              }}
            />
          )}
        </div>
      ))}
    </form>
  );
}

export default FilterForm;
