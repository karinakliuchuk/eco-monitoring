import React from 'react';

function DataTable({ data, loading, error, onDelete, onEdit }) {
  if (loading) {
    return <div style={statusStyle}>SYSTEM_LOADING // CONNECTING_TO_NODES...</div>;
  }

  if (error) {
    return <div style={{ ...statusStyle, color: '#ff0055' }}>[ERROR]: {error}</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={cyberCardStyle}>
          <div style={{ color: '#00f3ff', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '2px' }}>
            [ NO_DATA_DETECTED ]
          </div>
          <p style={{ color: '#8a99ad', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
            База даних не містить записів. Скористайтеся формою вище, щоб додати першу станцію моніторингу повітря.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerCardStyle}>
        <span style={{ color: '#00f3ff', letterSpacing: '1.5px', fontWeight: 'bold' }}>SYSTEM // ACTIVE_NODES</span>
        <span style={badgeStyle}>COUNT: {data.length}</span>
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>STATION</th>
              <th style={thStyle}>CITY</th>
              <th style={thStyle}>GEO_COORDS</th>
              <th style={thStyle}>PM2.5</th>
              <th style={thStyle}>PM10</th>
              <th style={thStyle}>NO₂</th>
              <th style={thStyle}>TIMESTAMP</th>
              <th style={thStyle}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item._id || index} style={trStyle}>
                <td style={{ ...tdStyle, color: '#00f3ff', fontWeight: 'bold' }}>{item.station_name}</td>
                <td style={tdStyle}>{item.city}</td>
                <td style={tdMutedStyle}>
                  [{item.location?.latitude}, {item.location?.longitude}]
                </td>
                <td style={tdStyle}>
                  <span style={getIndicatorStyle(item.pollutants?.pm25)}>
                    {item.pollutants?.pm25 ?? '-'} μg/m³
                  </span>
                </td>
                <td style={tdStyle}>{item.pollutants?.pm10 ?? '-'} μg/m³</td>
                <td style={tdStyle}>{item.pollutants?.no2 ?? '-'} μg/m³</td>
                <td style={tdMutedStyle}>
                  {item.measured_at ? new Date(item.measured_at).toLocaleString('uk-UA') : '-'}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => onEdit(item)} style={editBtnStyle}>
                      РЕДАГ.
                    </button>
                    <button onClick={() => onDelete(item._id)} style={deleteBtnStyle}>
                      ВИДАЛИТИ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const getIndicatorStyle = (val) => {
  let color = '#00ff66';
  let border = 'rgba(0, 255, 102, 0.4)';
  if (val > 25) { color = '#ffbb00'; border = 'rgba(255, 187, 0, 0.4)'; }
  if (val > 50) { color = '#ff0055'; border = 'rgba(255, 0, 85, 0.4)'; }
  return {
    color: color,
    border: `1px solid ${border}`,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '0.85rem'
  };
};

const containerStyle = { maxWidth: '1200px', margin: '0 auto', padding: '0 20px' };
const headerCardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' };
const badgeStyle = { border: '1px solid #00f3ff', color: '#00f3ff', padding: '4px 12px', borderRadius: '4px', fontSize: '0.85rem' };
const tableWrapperStyle = { backgroundColor: 'rgba(12, 14, 22, 0.85)', borderRadius: '12px', border: '1px solid rgba(0, 243, 255, 0.2)', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { backgroundColor: 'rgba(20, 24, 38, 0.95)', color: '#00f3ff', padding: '16px', fontSize: '0.85rem', letterSpacing: '1px', borderBottom: '1px solid rgba(0, 243, 255, 0.2)' };
const trStyle = { borderBottom: '1px solid rgba(255, 255, 255, 0.05)' };
const tdStyle = { padding: '16px', fontSize: '0.95rem' };
const tdMutedStyle = { ...tdStyle, color: '#6272a4', fontSize: '0.85rem' };
const statusStyle = { textAlign: 'center', padding: '60px', color: '#00f3ff', letterSpacing: '2px', fontSize: '1.1rem' };
const cyberCardStyle = {
  textAlign: 'center',
  padding: '60px 30px',
  backgroundColor: 'rgba(12, 14, 22, 0.75)',
  border: '1px solid rgba(0, 243, 255, 0.25)',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  width: '100%',
  boxSizing: 'border-box'
};
const editBtnStyle = {
  backgroundColor: 'rgba(255, 187, 0, 0.1)',
  border: '1px solid #ffbb00',
  color: '#ffbb00',
  padding: '5px 10px',
  borderRadius: '4px',
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  cursor: 'pointer'
};
const deleteBtnStyle = {
  backgroundColor: 'rgba(255, 0, 85, 0.1)',
  border: '1px solid #ff0055',
  color: '#ff0055',
  padding: '5px 10px',
  borderRadius: '4px',
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  cursor: 'pointer'
};

export default DataTable;