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

const INITIAL_SOURCE = {
  H: '40',
  D: '1.2',
  w0: '8.0',
  T_gas: '135',
  T_air: '25.6',
  A: '180',
  eta: '1',
  cleaning_efficiency: '92'
};

const INITIAL_EMISSIONS = [
  { pollutant: 'NO2', M: '12.0', background_mg_m3: '0.045' },
  { pollutant: 'SO2', M: '18.5', background_mg_m3: '0.025' },
  { pollutant: 'PM10', M: '4.2', background_mg_m3: '0.060' }
];

export default function DispersionForm({ annualSnapshot = null }) {
  const [source, setSource] = useState(INITIAL_SOURCE);
  const [emissions, setEmissions] = useState(INITIAL_EMISSIONS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [bgLoadedFromPartA, setBgLoadedFromPartA] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState([]);
  const [response, setResponse] = useState(null);

  // Автопідстановка фонових концентрацій Cф (P95) із Частини А Каріни
  useEffect(() => {
    const pollutantsMap = annualSnapshot?.pollutants;
    if (!pollutantsMap) return;

    let applied = false;
    setEmissions((prev) =>
      prev.map((item) => {
        const stat = pollutantsMap[item.pollutant];
        if (!stat || stat.c_background_p95 === null || stat.c_background_p95 === undefined) {
          return item;
        }
        applied = true;
        // Переводимо ug/m3 -> mg/m3 (якщо CO, то вже в mg/m3)
        const bgMgM3 = stat.unit === 'ug/m3'
          ? stat.c_background_p95 / 1000
          : stat.c_background_p95;

        return {
          ...item,
          background_mg_m3: bgMgM3.toFixed(4)
        };
      })
    );
    if (applied) setBgLoadedFromPartA(true);
  }, [annualSnapshot]);

  const handleSourceChange = (e) => {
    const { name, value } = e.target;
    setSource((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmissionChange = (index, field, value) => {
    setEmissions((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);
    setResponse(null);

    const payload = {
      H: parseFloat(source.H),
      D: parseFloat(source.D),
      w0: parseFloat(source.w0),
      T_gas: parseFloat(source.T_gas),
      T_air: parseFloat(source.T_air),
      A: parseFloat(source.A),
      eta: parseFloat(source.eta),
      cleaning_efficiency: parseFloat(source.cleaning_efficiency),
      emissions: emissions.map((row) => ({
        pollutant: row.pollutant,
        M: parseFloat(row.M),
        background_mg_m3: parseFloat(row.background_mg_m3) || 0
      }))
    };

    try {
      const res = await fetch(`${API_BASE}/api/v7/dispersion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 422 && Array.isArray(json.fields)) {
          setFieldErrors(json.fields);
        }
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setResponse(json);
      setSelectedIdx(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeResult = response?.data?.results?.[selectedIdx] || null;

  const profileChartData = activeResult
    ? {
        labels: activeResult.profile.map((p) => `${Math.round(p.x_m)} м`),
        datasets: [
          {
            label: `C(x) + Cф для ${activeResult.pollutant} (мг/м³)`,
            data: activeResult.profile.map((p) =>
              Number((p.c_mg_m3 + activeResult.background_mg_m3).toFixed(5))
            ),
            borderColor: '#00f3ff',
            backgroundColor: 'rgba(0, 243, 255, 0.15)',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.25
          },
          {
            label: `ГДК м.р. (${activeResult.gdk_mr_mg_m3} мг/м³)`,
            data: activeResult.profile.map(() => activeResult.gdk_mr_mg_m3),
            borderColor: '#ff0055',
            borderDash: [6, 6],
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      }
    : null;

  const profileChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } }
    },
    scales: {
      x: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(255,255,255,0.08)' }, beginAtZero: true }
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ color: '#00f3ff', fontWeight: 'bold', letterSpacing: '1.5px' }}>
            VARIANT_07 // ОНД-86 РОЗСІЮВАННЯ ВИКИДІВ ТОЧКОВОГО ДЖЕРЕЛА
          </span>
          <span style={bgLoadedFromPartA ? tagActiveStyle : tagStyle}>
            {bgLoadedFromPartA
              ? `ФОН Cф (P95): ПІДТЯГНУТО ЗІ СТАНЦІЇ ${annualSnapshot?.station?.station_id || 'KYIV-01'}`
              : 'ФОН Cф: РУЧНИЙ / СТАНДАРТ'}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={gridStyle}>
            <Field label="ВИСОТА ТРУБИ H (м)" name="H" value={source.H} onChange={handleSourceChange} />
            <Field label="ДІАМЕТР ГИРЛА D (м)" name="D" value={source.D} onChange={handleSourceChange} />
            <Field label="ШВИДКІСТЬ w₀ (м/с)" name="w0" value={source.w0} onChange={handleSourceChange} />
            <Field label="ТЕМП. ГАЗІВ Tг (°C)" name="T_gas" value={source.T_gas} onChange={handleSourceChange} />
            <Field label="ТЕМП. ПОВІТРЯ Tпов (°C)" name="T_air" value={source.T_air} onChange={handleSourceChange} />
            <Field label="КОЕФІЦІЄНТ A (Київ=180)" name="A" value={source.A} onChange={handleSourceChange} />
            <Field label="РЕЛЬЄФ η (рівнина=1)" name="eta" value={source.eta} onChange={handleSourceChange} />
            <Field label="ОЧИЩЕННЯ (%)" name="cleaning_efficiency" value={source.cleaning_efficiency} onChange={handleSourceChange} />
          </div>

          <div style={{ marginTop: '20px', marginBottom: '12px', color: '#00f3ff', fontSize: '0.85rem', letterSpacing: '1px' }}>
            ЗАБРУДНЮВАЧІ (потужність викиду M та фон Cф за Наказом № 286):
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {emissions.map((row, idx) => (
              <div key={row.pollutant} style={emissionRowStyle}>
                <strong style={{ color: '#00f3ff', minWidth: '60px' }}>{row.pollutant}</strong>
                <div style={inlineInputGroup}>
                  <label style={labelStyle}>M (г/с)</label>
                  <input
                    type="number"
                    step="any"
                    value={row.M}
                    onChange={(e) => handleEmissionChange(idx, 'M', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={inlineInputGroup}>
                  <label style={labelStyle}>Фон Cф (мг/м³)</label>
                  <input
                    type="number"
                    step="any"
                    value={row.background_mg_m3}
                    onChange={(e) => handleEmissionChange(idx, 'background_mg_m3', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? 'CALCULATING // ОНД-86...' : 'РОЗРАХУВАТИ РОЗСІЮВАННЯ (POST /api/v7/dispersion)'}
          </button>
        </form>

        {/* Стан ERROR (422 або мережева помилка) */}
        {error && (
          <div style={errorBoxStyle}>
            <div><strong>[ERROR]:</strong> {error}</div>
            {fieldErrors.length > 0 && (
              <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                {fieldErrors.map((fe, i) => (
                  <li key={i}><code>{fe.field}</code>: {fe.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Стан SUCCESS */}
        {response && (
          <div style={{ marginTop: '28px' }}>
            <div style={sectionTitleStyle}>ПАРАМЕТРИ ДЖЕРЕЛА ТА КОЕФІЦІЄНТИ ОНД-86</div>
            <div style={metricsGridStyle}>
              <MetricBox label="V₁ (м³/с)" value={response.data.source_params.V1_m3_s} />
              <MetricBox label="ΔT (°C)" value={response.data.source_params.deltaT_c} />
              <MetricBox label="f" value={response.data.source_params.f} />
              <MetricBox label="vₘ (м/с)" value={response.data.source_params.vm_m_s} />
              <MetricBox label="m" value={response.data.source_params.m} />
              <MetricBox label="n" value={response.data.source_params.n} />
              <MetricBox label="d" value={response.data.source_params.d} />
            </div>

            <div style={sectionTitleStyle}>ПОРІВНЯННЯ З ГДК м.р. (Наказ МОЗ № 52)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>РЕЧОВИНА</th>
                    <th style={thStyle}>F</th>
                    <th style={thStyle}>Cₘ (мг/м³)</th>
                    <th style={thStyle}>Cф (мг/м³)</th>
                    <th style={thStyle}>Cₘ + Cф</th>
                    <th style={thStyle}>ГДК м.р.</th>
                    <th style={thStyle}>Xₘ (м)</th>
                    <th style={thStyle}>СТАТУС</th>
                  </tr>
                </thead>
                <tbody>
                  {response.data.results.map((r, idx) => (
                    <tr
                      key={r.pollutant}
                      onClick={() => setSelectedIdx(idx)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        backgroundColor: selectedIdx === idx ? 'rgba(0, 243, 255, 0.08)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ ...tdStyle, color: '#00f3ff', fontWeight: 'bold' }}>{r.pollutant}</td>
                      <td style={tdStyle}>{r.F}</td>
                      <td style={tdStyle}>{r.Cm_mg_m3}</td>
                      <td style={tdStyle}>{r.background_mg_m3}</td>
                      <td style={tdStyle}><strong>{r.total_mg_m3}</strong></td>
                      <td style={tdStyle}>{r.gdk_mr_mg_m3}</td>
                      <td style={tdStyle}>{r.Xm_m}</td>
                      <td style={tdStyle}>
                        <span style={r.exceeded ? dangerBadge : okBadge}>
                          {r.exceeded ? `ПЕРЕВИЩЕННЯ (${r.gdk_ratio}x)` : `НОРМА (${r.gdk_ratio}x)`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeResult && profileChartData && (
              <>
                <div style={sectionTitleStyle}>
                  ПРОФІЛЬ КОНЦЕНТРАЦІЙ C(x) ДО 10·Xₘ ДЛЯ {activeResult.pollutant} (натисніть рядок вище, щоб змінити речовину)
                </div>
                <div style={{ height: '280px', backgroundColor: 'rgba(7,9,14,0.85)', border: '1px solid rgba(0,243,255,0.2)', borderRadius: '8px', padding: '14px' }}>
                  <Line data={profileChartData} options={profileChartOptions} />
                </div>

                <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>x / Xₘ</th>
                        <th style={thStyle}>x (м)</th>
                        <th style={thStyle}>s₁</th>
                        <th style={thStyle}>C(x), мг/м³</th>
                        <th style={thStyle}>C(x), мкг/м³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeResult.profile.map((pt) => (
                        <tr key={pt.x_to_xm} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={tdStyle}>{pt.x_to_xm}</td>
                          <td style={tdStyle}>{pt.x_m}</td>
                          <td style={tdStyle}>{pt.s1}</td>
                          <td style={tdStyle}>{pt.c_mg_m3}</td>
                          <td style={tdStyle}>{pt.c_ug_m3}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={sectionTitleStyle}>ПАСПОРТ РОЗРАХУНКУ</div>
            <pre style={passportPreStyle}>
              {JSON.stringify(response.passport, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={labelStyle}>{label}</label>
      <input type="number" step="any" name={name} value={value} onChange={onChange} style={inputStyle} />
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div style={metricBoxStyle}>
      <div style={{ fontSize: '0.72rem', color: '#6272a4' }}>{label}</div>
      <div style={{ fontSize: '1.05rem', color: '#00f3ff', fontWeight: 'bold', marginTop: '4px' }}>{value}</div>
    </div>
  );
}

const containerStyle = { maxWidth: '1200px', margin: '24px auto 0 auto', padding: '0 20px' };
const cardStyle = {
  backgroundColor: 'rgba(12, 14, 22, 0.85)',
  borderRadius: '10px',
  border: '1px solid rgba(0, 243, 255, 0.25)',
  padding: '24px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
};
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px',
  marginBottom: '20px',
  paddingBottom: '12px',
  borderBottom: '1px solid rgba(0, 243, 255, 0.15)'
};
const tagStyle = { fontSize: '0.75rem', border: '1px solid #6272a4', color: '#a9b7c6', padding: '4px 10px', borderRadius: '4px' };
const tagActiveStyle = { fontSize: '0.75rem', border: '1px solid #00e676', color: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.08)', padding: '4px 10px', borderRadius: '4px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' };
const labelStyle = { fontSize: '0.72rem', color: '#6272a4', letterSpacing: '1px' };
const inputStyle = {
  backgroundColor: 'rgba(7, 9, 14, 0.9)',
  border: '1px solid rgba(0, 243, 255, 0.3)',
  borderRadius: '6px',
  padding: '9px 12px',
  color: '#e0e6ed',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  outline: 'none'
};
const emissionRowStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px',
  padding: '10px 14px',
  backgroundColor: 'rgba(20, 24, 38, 0.6)',
  borderRadius: '8px',
  border: '1px solid rgba(0, 243, 255, 0.15)'
};
const inlineInputGroup = { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px' };
const submitBtnStyle = {
  width: '100%',
  backgroundColor: 'rgba(0, 243, 255, 0.12)',
  border: '1px solid #00f3ff',
  color: '#00f3ff',
  padding: '12px 16px',
  borderRadius: '6px',
  fontFamily: 'inherit',
  fontWeight: 'bold',
  letterSpacing: '1px',
  cursor: 'pointer'
};
const errorBoxStyle = {
  marginTop: '16px',
  backgroundColor: 'rgba(255, 0, 85, 0.1)',
  border: '1px solid #ff0055',
  color: '#ff0055',
  padding: '12px 16px',
  borderRadius: '6px',
  fontSize: '0.85rem'
};
const sectionTitleStyle = {
  marginTop: '22px',
  marginBottom: '12px',
  color: '#00f3ff',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  letterSpacing: '1.2px'
};
const metricsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' };
const metricBoxStyle = {
  backgroundColor: 'rgba(20, 24, 38, 0.85)',
  border: '1px solid rgba(0, 243, 255, 0.2)',
  borderRadius: '8px',
  padding: '10px 12px',
  textAlign: 'center'
};
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' };
const thStyle = { backgroundColor: 'rgba(20, 24, 38, 0.95)', color: '#00f3ff', padding: '10px 12px', fontSize: '0.78rem', borderBottom: '1px solid rgba(0, 243, 255, 0.2)' };
const tdStyle = { padding: '10px 12px' };
const okBadge = { color: '#00e676', border: '1px solid rgba(0,230,118,0.4)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' };
const dangerBadge = { color: '#ff0055', border: '1px solid rgba(255,0,85,0.4)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' };
const passportPreStyle = {
  backgroundColor: 'rgba(7, 9, 14, 0.92)',
  border: '1px solid rgba(0, 243, 255, 0.2)',
  borderRadius: '8px',
  padding: '14px',
  color: '#8be9fd',
  fontSize: '0.78rem',
  overflowX: 'auto'
};