import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function StationDashboard({ stationId = 'KYIV-01', year = 2025, onAnnualLoaded }) {
  const [annualData, setAnnualData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [selectedPollutant, setSelectedPollutant] = useState('PM2.5');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStationOverview() {
      try {
        setLoading(true);
        setError(null);

        const [annualRes, aqiRes] = await Promise.all([
          fetch(`${API_BASE}/api/eco/stations/${stationId}/annual?year=${year}`),
          fetch(`${API_BASE}/api/eco/stations/${stationId}/aqi`)
        ]);

        if (!annualRes.ok) throw new Error(`Помилка завантаження річних даних: ${annualRes.status}`);
        if (!aqiRes.ok) throw new Error(`Помилка завантаження AQI: ${aqiRes.status}`);

        const annualJson = await annualRes.json();
        const aqiJson = await aqiRes.json();

        if (isMounted) {
          setAnnualData(annualJson);
          setAqiData(aqiJson);
          if (onAnnualLoaded) onAnnualLoaded(annualJson);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStationOverview();
    return () => { isMounted = false; };
  }, [stationId, year]);

  useEffect(() => {
    let isMounted = true;
    async function loadDailySeries() {
      try {
        const res = await fetch(
          `${API_BASE}/api/eco/stations/${stationId}/daily?year=${year}&pollutant=${encodeURIComponent(selectedPollutant)}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted) setDailyData(json.data || []);
      } catch (err) {
        console.error('Помилка графіка:', err);
      }
    }

    loadDailySeries();
    return () => { isMounted = false; };
  }, [stationId, year, selectedPollutant]);

  if (loading) {
    return <div style={cardStyle}>[ LOADING_TELEMETRY_DATA... ]</div>;
  }

  if (error) {
    return <div style={{ ...cardStyle, borderColor: '#ff0055', color: '#ff0055' }}>ERROR: {error}</div>;
  }

  if (!annualData) return null;

  const { station, iza, pollutants, invalid_records_excluded } = annualData;
  const currentNorm = pollutants[selectedPollutant]?.gdk_sd || null;
  const currentUnit = pollutants[selectedPollutant]?.unit || 'ug/m3';

  const chartLabels = dailyData.map((d) => new Date(d.day).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }));
  const dailyValues = dailyData.map((d) => d.mean);
  const gdkLine = dailyData.map(() => currentNorm);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: `Добове середнє ${selectedPollutant} (${currentUnit})`,
        data: dailyValues,
        borderColor: '#00f3ff',
        backgroundColor: 'rgba(0, 243, 255, 0.15)',
        borderWidth: 1.5,
        pointRadius: 1.5,
        spanGaps: false,
        tension: 0.2
      },
      ...(currentNorm
        ? [
            {
              label: `ГДК с.д. (${currentNorm} ${currentUnit})`,
              data: gdkLine,
              borderColor: '#ff0055',
              borderDash: [6, 6],
              borderWidth: 2,
              pointRadius: 0
            }
          ]
        : [])
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } }
    },
    scales: {
      x: { ticks: { color: '#6272a4', maxTicksLimit: 15 }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(255,255,255,0.08)' } }
    }
  };

  const aqiOverall = aqiData?.aqi?.overall;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', display: 'grid', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>STATION_NODE // {station.station_id}</div>
          <h2 style={{ margin: '8px 0', color: '#00f3ff', fontSize: '1.25rem' }}>{station.station_name}</h2>
          <p style={mutedTextStyle}>Місто: {station.city} ({station.settlement_type})</p>
          <p style={mutedTextStyle}>Населення: {station.population?.toLocaleString('uk-UA')} осіб</p>
          <p style={mutedTextStyle}>
            Координати: {station.location.latitude}, {station.location.longitude}
          </p>
          <p style={{ ...mutedTextStyle, color: '#ff9100', marginTop: '10px' }}>
            Відфільтровано invalid-записів за {year} р.: {invalid_records_excluded}
          </p>
        </div>

        {aqiOverall && (
          <div style={{ ...cardStyle, borderColor: aqiOverall.color }}>
            <div style={labelStyle}>НАКАЗ МІНДОВКІЛЛЯ № 590 // ПОГОДИННИЙ ІНДЕКС</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '14px 0' }}>
              <div
                style={{
                  backgroundColor: aqiOverall.color,
                  color: '#07090e',
                  fontWeight: 'bold',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '1.2rem',
                  boxShadow: `0 0 16px ${aqiOverall.color}66`
                }}
              >
                {aqiOverall.name.toUpperCase()}
              </div>
              {aqiData.aqi.incomplete && (
                <span style={{ color: '#ff9100', fontSize: '0.85rem' }}>
                  ⚠ Неповний набір ({aqiData.aqi.measured_count}/{aqiData.aqi.required_count})
                </span>
              )}
            </div>
            <div style={mutedTextStyle}>
              Час вимірювання: {new Date(aqiData.measurement_time).toLocaleString('uk-UA')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {Object.entries(aqiData.aqi.sub_indices).map(([pol, info]) => (
                <span
                  key={pol}
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${info ? info.color : '#444'}`,
                    color: info ? info.color : '#666'
                  }}
                >
                  {pol}: {info ? `${info.value} (${info.name})` : 'н/д'}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={labelStyle}>РІЧНИЙ ІНДЕКС ЗАБРУДНЕННЯ АТМОСФЕРИ (ІЗА)</div>
          <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#00f3ff', margin: '12px 0' }}>
            {iza.iza} <span style={{ fontSize: '1rem', color: '#ffea00' }}>[{iza.level}]</span>
          </div>
          <p style={mutedTextStyle}>
            Розраховано за {iza.components.length} речовинами з урахуванням класів небезпечності (1–4).
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>РІЧНІ АГРЕГОВАНІ ПОКАЗНИКИ ({year} РІК)</div>
        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0, 243, 255, 0.3)', color: '#00f3ff', textAlign: 'left' }}>
                <th style={thStyle}>Речовина</th>
                <th style={thStyle}>Од.</th>
                <th style={thStyle}>Повнота</th>
                <th style={thStyle}>Річне сер.</th>
                <th style={thStyle}>Медіана</th>
                <th style={thStyle}>P90.4</th>
                <th style={thStyle}>P98</th>
                <th style={thStyle}>Фон Cф (P95)</th>
                <th style={thStyle}>ГДК с.д.</th>
                <th style={thStyle}>Діб &gt; норми</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(pollutants).map((p) => {
                const exceededAnnual = p.annual_mean && p.gdk_sd && p.annual_mean > p.gdk_sd;
                return (
                  <tr key={p.pollutant} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={tdStyle}>
                      <strong>{p.pollutant}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#6272a4' }}>{p.name}</div>
                    </td>
                    <td style={tdStyle}>{p.unit}</td>
                    <td style={{ ...tdStyle, color: p.complete_90pct ? '#00e676' : '#ff9100' }}>
                      {p.completeness_pct}% ({p.valid_days} дн.)
                    </td>
                    <td style={{ ...tdStyle, color: exceededAnnual ? '#ff0055' : '#e0e6ed', fontWeight: 'bold' }}>
                      {p.annual_mean ?? 'Неповно (<90%)'}
                    </td>
                    <td style={tdStyle}>{p.median}</td>
                    <td style={tdStyle}>{p.p90_4}</td>
                    <td style={tdStyle}>{p.p98}</td>
                    <td style={{ ...tdStyle, color: '#00f3ff' }}>{p.c_background_p95}</td>
                    <td style={tdStyle}>{p.gdk_sd ?? '—'}</td>
                    <td style={{ ...tdStyle, color: p.exceedance_days > 0 ? '#ff9100' : '#00e676' }}>
                      {p.exceedance_days}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={labelStyle}>ДИНАМІКА ДОБОВИХ СЕРЕДНІХ КОНЦЕНТРАЦІЙ ({year})</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.keys(pollutants).map((pol) => (
              <button
                key={pol}
                onClick={() => setSelectedPollutant(pol)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  borderRadius: '4px',
                  border: selectedPollutant === pol ? '1px solid #00f3ff' : '1px solid rgba(255,255,255,0.2)',
                  backgroundColor: selectedPollutant === pol ? 'rgba(0, 243, 255, 0.2)' : 'transparent',
                  color: selectedPollutant === pol ? '#00f3ff' : '#e0e6ed'
                }}
              >
                {pol}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: '320px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: 'rgba(12, 14, 22, 0.85)',
  border: '1px solid rgba(0, 243, 255, 0.25)',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
};

const labelStyle = {
  fontSize: '0.78rem',
  letterSpacing: '1.5px',
  color: '#6272a4',
  fontWeight: 'bold'
};

const mutedTextStyle = {
  margin: '4px 0',
  fontSize: '0.9rem',
  color: '#a9b7c6'
};

const thStyle = { padding: '10px 8px' };
const tdStyle = { padding: '10px 8px' };
