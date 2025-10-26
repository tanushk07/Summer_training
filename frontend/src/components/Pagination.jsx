import React from 'react';

function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
        Previous
      </button>
      <span>
        Page {currentPage} of {totalPages || 1}
      </span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
        Next
      </button>
    </div>
  );
}

export default Pagination;
