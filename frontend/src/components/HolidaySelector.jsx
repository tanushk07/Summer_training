import React, { useState, useEffect } from 'react';

function HolidaySelector({ initialHolidays = [], onChange }) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (onChange) onChange(holidays);
  }, [holidays, onChange]);

  const addHoliday = () => {
    if (!inputValue) return;
    if (holidays.includes(inputValue)) return; // Prevent duplicates
    setHolidays([...holidays, inputValue]);
    setInputValue('');
  };

  const removeHoliday = (date) => {
    setHolidays(holidays.filter(h => h !== date));
  };

  return (
    <div className="holiday-container" style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
      <label htmlFor="holidayInput" style={{ marginBottom: '0.5rem' }}>Select Holidays:</label>
      <div className="flexbox" style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '10px', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="date"
          id="holidayInput"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          style={{ width: 'auto', padding: '6px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button className="addholiday" onClick={addHoliday} style={{ backgroundColor: '#f04e23', color: 'white', borderRadius: '20px', border: 'none', padding: '8px' }}>
          Add Holiday
        </button>
      </div>
      {holidays.length > 0 && (
        <ul id="holidayList" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', listStyleType: 'none', padding: 0 }}>
          {holidays.map(date => (
            <li key={date} className="hollist" style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', backgroundColor: '#f04e23', color: 'white', borderRadius: '20px', border: '1px solid grey' }}>
              {date}
              <button
                className="crossbtn"
                onClick={() => removeHoliday(date)}
                style={{ marginLeft: '5px', border: 'none', backgroundColor: 'transparent', color: 'white', cursor: 'pointer', fontSize: '1rem' }}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HolidaySelector;
