import React, { useState, useEffect } from 'react';
import DataTable from './components/DataTable';
import AddStationForm from './components/AddStationForm';
import StationDashboard from './components/StationDashboard';
import DispersionForm from './components/DispersionForm';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api/airquality`;

function App() {
  const [activeTab, setActiveTab] = useState('lab3');
  const [annualSnapshot, setAnnualSnapshot] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`Помилка HTTP: ${response.status}`);
      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStation = async (newStation) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStation)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Помилка створення запису');
    setData((prevData) => [result.data, ...prevData]);
  };

  const handleUpdateStation = async (id, updatedStation) => {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedStation)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Помилка оновлення запису');
    setData((prevData) => prevData.map((item) => (item._id === id ? result.data : item)));
    setEditingItem(null);
  };

  const handleDeleteStation = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Помилка видалення запису');
      }
      setData((prevData) => prevData.filter((item) => item._id !== id));
    } catch (err) {
      alert(`Помилка при видаленні: ${err.message}`);
    }
  };

  return (
    <div style={cyberBackgroundStyle}>
      <header style={glassHeaderStyle}>
        <div style={headerContentStyle}>
          <div>
            <h1 style={titleStyle}>AIR_QUALITY // MONITORING_SYSTEM</h1>
            <span style={subtitleStyle}>NETWORK_STATUS: ONLINE // LAB_03_EDITION</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setActiveTab('lab3')}
              style={activeTab === 'lab3' ? activeTabBtnStyle : tabBtnStyle}
            >
              [ АНАЛІТИКА ТА ОНД-86 ]
            </button>
            <button
              onClick={() => setActiveTab('crud')}
              style={activeTab === 'crud' ? activeTabBtnStyle : tabBtnStyle}
            >
              [ РЕЄСТР ПОСТІВ (ЛР 1-2) ]
            </button>
            <div style={liveBadgeStyle}>● LIVE_FEED</div>
          </div>
        </div>
      </header>

      <main style={{ padding: '32px 0' }}>
        {activeTab === 'lab3' ? (
          <>
            <StationDashboard
              stationId="KYIV-01"
              year={2025}
              onAnnualLoaded={(snapshot) => setAnnualSnapshot(snapshot)}
            />
            <DispersionForm annualSnapshot={annualSnapshot} />
          </>
        ) : (
          <>
            <AddStationForm
              onAdd={handleAddStation}
              onUpdate={handleUpdateStation}
              editingItem={editingItem}
              onCancelEdit={() => setEditingItem(null)}
            />
            <DataTable
              data={data}
              loading={loading}
              error={error}
              onDelete={handleDeleteStation}
              onEdit={(item) => setEditingItem(item)}
            />
          </>
        )}
      </main>
    </div>
  );
}

const cyberBackgroundStyle = {
  backgroundColor: '#07090e',
  backgroundImage: 'radial-gradient(circle at 50% -10%, rgba(0, 243, 255, 0.15) 0%, transparent 70%)',
  minHeight: '100vh',
  fontFamily: "'Share Tech Mono', 'Courier New', monospace",
  color: '#e0e6ed'
};

const glassHeaderStyle = {
  backgroundColor: 'rgba(12, 14, 22, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderBottom: '1px solid rgba(0, 243, 255, 0.25)',
  boxShadow: '0 8px 32px rgba(0, 243, 255, 0.12)',
  padding: '24px 40px',
  position: 'sticky',
  top: 0,
  zIndex: 100
};

const headerContentStyle = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px'
};

const titleStyle = {
  margin: 0,
  fontSize: '1.6rem',
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

const tabBtnStyle = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#a9b7c6',
  padding: '8px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.82rem'
};

const activeTabBtnStyle = {
  ...tabBtnStyle,
  border: '1px solid #00f3ff',
  backgroundColor: 'rgba(0, 243, 255, 0.15)',
  color: '#00f3ff',
  boxShadow: '0 0 10px rgba(0, 243, 255, 0.25)'
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