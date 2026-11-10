import React, { useState, useEffect } from 'react';
import DataTable from './components/DataTable';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:3001/api/airquality');
      
      if (!response.ok) {
        throw new Error(`Помилка HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={cyberBackgroundStyle}>
      {/* Широкий засклений Header */}
      <header style={glassHeaderStyle}>
        <div style={headerContentStyle}>
          <div>
            <h1 style={titleStyle}>AIR_QUALITY // MONITORING_SYSTEM</h1>
            <span style={subtitleStyle}>NETWORK_STATUS: ONLINE</span>
          </div>
          <div style={liveBadgeStyle}>● LIVE_FEED</div>
        </div>
      </header>

      <main style={{ padding: '40px 0' }}>
        <DataTable data={data} loading={loading} error={error} />
      </main>
    </div>
  );
}

// Чистий темний кібер-фон БЕЗ сітки
const cyberBackgroundStyle = {
  backgroundColor: '#07090e',
  backgroundImage: 'radial-gradient(circle at 50% -10%, rgba(0, 243, 255, 0.15) 0%, transparent 70%)',
  minHeight: '100vh',
  fontFamily: "'Share Tech Mono', 'Courier New', monospace",
  color: '#e0e6ed'
};

// Ширша шапка
const glassHeaderStyle = {
  backgroundColor: 'rgba(12, 14, 22, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderBottom: '1px solid rgba(0, 243, 255, 0.25)',
  boxShadow: '0 8px 32px rgba(0, 243, 255, 0.12)',
  padding: '32px 40px', // Збільшені відступи
  position: 'sticky',
  top: 0,
  zIndex: 100
};

const headerContentStyle = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const titleStyle = {
  margin: 0,
  fontSize: '1.8rem',
  fontWeight: '700',
  letterSpacing: '2.5px',
  color: '#00f3ff',
  textShadow: '0 0 12px rgba(0, 243, 255, 0.6)'
};

const subtitleStyle = {
  display: 'block',
  marginTop: '6px',
  fontSize: '0.8rem',
  color: '#6272a4',
  letterSpacing: '1.5px'
};

const liveBadgeStyle = {
  color: '#ff0055',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  letterSpacing: '1.5px',
  border: '1px solid #ff0055',
  padding: '6px 16px',
  borderRadius: '20px',
  boxShadow: '0 0 12px rgba(255, 0, 85, 0.3)',
  backgroundColor: 'rgba(255, 0, 85, 0.05)'
};

export default App;