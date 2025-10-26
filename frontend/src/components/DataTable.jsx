import React, { useState, useMemo } from 'react';

function DataTable({ columns, data, rowsPerPageDefault = 10 }) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(rowsPerPageDefault);

  // Filter data based on search input (case-insensitive)
  const filteredData = useMemo(() => {
    if (!search) return data;
    const lowerSearch = search.toLowerCase();

    return data.filter((row) =>
      columns.some((col) => {
        const cellValue = row[col.accessor];
        return cellValue && cellValue.toString().toLowerCase().includes(lowerSearch);
      })
    );
  }, [search, data, columns]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  // Paginate filtered data
  const currentData = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIdx, startIdx + rowsPerPage);
  }, [currentPage, filteredData, rowsPerPage]);

  // Pagination handlers
  const goToPrevPage = () => setCurrentPage((old) => Math.max(1, old - 1));
  const goToNextPage = () => setCurrentPage((old) => Math.min(totalPages, old + 1));

  // Reset page when search or data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, data]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        style={{ marginBottom: '1rem', padding: '0.5rem', width: '100%', maxWidth: '400px' }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(({ header, accessor }) => (
              <th
                key={accessor}
                style={{
                  border: '1px solid #ddd',
                  padding: '0.5rem',
                  backgroundColor: '#f2f2f2',
                  textAlign: 'left',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {currentData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '1rem', textAlign: 'center' }}>
                No data found.
              </td>
            </tr>
          ) : (
            currentData.map((row, idx) => (
              <tr
                key={idx}
                style={{ borderBottom: '1px solid #ddd' }}
              >
                {columns.map(({ accessor }) => (
                  <td key={accessor} style={{ padding: '0.5rem' }}>
                    {row[accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <button onClick={goToPrevPage} disabled={currentPage === 1}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages || 1}
        </span>
        <button onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0}>
          Next
        </button>
      </div>
    </div>
  );
}

export default DataTable;
