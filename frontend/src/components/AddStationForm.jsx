import React, { useState, useEffect } from 'react';

const initialFormState = {
  station_name: '',
  city: '',
  latitude: '',
  longitude: '',
  pm25: '',
  pm10: '',
  no2: ''
};

// Дозволяємо лише українські/латинські літери, пробіли, апостроф та дефіс
const CITY_INPUT_REGEX = /^[а-яА-ЯіїєґІЇЄҐa-zA-Z\s'’-]*$/;
const CITY_SUBMIT_REGEX = /^[а-яА-ЯіїєґІЇЄҐa-zA-Z\s'’-]+$/;

function AddStationForm({ onAdd, onUpdate, editingItem, onCancelEdit }) {
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Якщо вибрано станцію для редагування — заповнюємо поля форми її даними
  useEffect(() => {
    if (editingItem) {
      setFormData({
        station_name: editingItem.station_name || '',
        city: editingItem.city || '',
        latitude: editingItem.location?.latitude ?? '',
        longitude: editingItem.location?.longitude ?? '',
        pm25: editingItem.pollutants?.pm25 ?? '',
        pm10: editingItem.pollutants?.pm10 ?? '',
        no2: editingItem.pollutants?.no2 ?? ''
      });
      setFormError(null);
    } else {
      setFormData(initialFormState);
    }
  }, [editingItem]);

  // Обробник зміни тексту в інпутах (керовані компоненти + блокування некоректних символів у місті)
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'city') {
      if (!CITY_INPUT_REGEX.test(value)) {
        setFormError('Назва міста може містити лише літери, пробіли, дефіс або апостроф (цифри та спецсимволи заборонені)');
        return;
      }
      setFormError(null);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Відправка форми (POST або PUT)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmedStation = formData.station_name.trim();
    const trimmedCity = formData.city.trim();

    if (
      !trimmedStation ||
      !trimmedCity ||
      formData.latitude === '' ||
      formData.longitude === '' ||
      formData.pm25 === ''
    ) {
      setFormError('Заповніть усі обов\'язкові поля (Назва, Місто, Координати, PM2.5)');
      return;
    }

    if (!CITY_SUBMIT_REGEX.test(trimmedCity)) {
      setFormError('Назва міста може містити лише літери, пробіли, дефіс або апостроф (без цифр і спецсимволів)');
      return;
    }

    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    const pm25 = parseFloat(formData.pm25);
    const pm10 = formData.pm10 !== '' ? parseFloat(formData.pm10) : undefined;
    const no2 = formData.no2 !== '' ? parseFloat(formData.no2) : undefined;

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setFormError('Координати поза допустимими межами (широта: від -90 до 90, довгота: від -180 до 180)');
      return;
    }

    if (pm25 < 0 || (pm10 !== undefined && pm10 < 0) || (no2 !== undefined && no2 < 0)) {
      setFormError('Показники забруднення (PM2.5, PM10, NO₂) не можуть бути від\'ємними');
      return;
    }

    const payload = {
      station_name: trimmedStation,
      city: trimmedCity,
      location: {
        latitude: lat,
        longitude: lon
      },
      pollutants: {
        pm25,
        pm10,
        no2
      }
    };

    try {
      setSubmitting(true);
      if (editingItem) {
        await onUpdate(editingItem._id, payload);
      } else {
        await onAdd(payload);
        setFormData(initialFormState);
      }
    } catch (err) {
      setFormError(err.message || 'Помилка при збереженні даних');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={formCardStyle}>
        <div style={headerStyle}>
          <span style={{ color: editingItem ? '#ffbb00' : '#00f3ff', fontWeight: 'bold', letterSpacing: '1.5px' }}>
            {editingItem ? `EDIT_NODE // ID: ${editingItem._id}` : 'DEPLOY_NEW_NODE // ADD_STATION'}
          </span>
          {editingItem && (
            <button type="button" onClick={onCancelEdit} style={cancelBtnStyle}>
              [ СКАСУВАТИ РЕДАГУВАННЯ ]
            </button>
          )}
        </div>

        {formError && <div style={errorBoxStyle}>[ERROR]: {formError}</div>}

        <form onSubmit={handleSubmit} style={gridFormStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>STATION_NAME *</label>
            <input
              type="text"
              name="station_name"
              placeholder="Напр. КПІ-Моніторинг-1"
              value={formData.station_name}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>CITY *</label>
            <input
              type="text"
              name="city"
              placeholder="Напр. Київ"
              value={formData.city}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>LATITUDE (Широта) *</label>
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              name="latitude"
              placeholder="50.4495"
              value={formData.latitude}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>LONGITUDE (Довгота) *</label>
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              name="longitude"
              placeholder="30.4564"
              value={formData.longitude}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>PM2.5 (μg/m³) *</label>
            <input
              type="number"
              step="any"
              min="0"
              name="pm25"
              placeholder="18.4"
              value={formData.pm25}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>PM10 (μg/m³)</label>
            <input
              type="number"
              step="any"
              min="0"
              name="pm10"
              placeholder="32.1"
              value={formData.pm10}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>NO₂ (μg/m³)</label>
            <input
              type="number"
              step="any"
              min="0"
              name="no2"
              placeholder="12.5"
              value={formData.no2}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={submitting} style={editingItem ? updateBtnStyle : submitBtnStyle}>
              {submitting ? 'PROCESSING...' : editingItem ? 'ОНОВИТИ ДАНІ (PUT)' : '+ ДОДАТИ СТАНЦІЮ (POST)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const containerStyle = { maxWidth: '1200px', margin: '0 auto 36px auto', padding: '0 20px' };
const formCardStyle = {
  backgroundColor: 'rgba(12, 14, 22, 0.85)',
  borderRadius: '12px',
  border: '1px solid rgba(0, 243, 255, 0.25)',
  padding: '24px',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
};
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
  paddingBottom: '12px',
  borderBottom: '1px solid rgba(0, 243, 255, 0.15)'
};
const gridFormStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px'
};
const inputGroupStyle = { display: 'flex', flexDirection: 'column', gap: '6px' };
const labelStyle = { fontSize: '0.75rem', color: '#6272a4', letterSpacing: '1px' };
const inputStyle = {
  backgroundColor: 'rgba(7, 9, 14, 0.9)',
  border: '1px solid rgba(0, 243, 255, 0.3)',
  borderRadius: '6px',
  padding: '10px 12px',
  color: '#e0e6ed',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  outline: 'none'
};
const submitBtnStyle = {
  width: '100%',
  backgroundColor: 'rgba(0, 243, 255, 0.12)',
  border: '1px solid #00f3ff',
  color: '#00f3ff',
  padding: '11px 16px',
  borderRadius: '6px',
  fontFamily: 'inherit',
  fontWeight: 'bold',
  letterSpacing: '1px',
  cursor: 'pointer',
  boxShadow: '0 0 12px rgba(0, 243, 255, 0.2)'
};
const updateBtnStyle = {
  ...submitBtnStyle,
  backgroundColor: 'rgba(255, 187, 0, 0.15)',
  border: '1px solid #ffbb00',
  color: '#ffbb00',
  boxShadow: '0 0 12px rgba(255, 187, 0, 0.2)'
};
const cancelBtnStyle = {
  backgroundColor: 'transparent',
  border: '1px solid #6272a4',
  color: '#8a99ad',
  padding: '4px 10px',
  borderRadius: '4px',
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  cursor: 'pointer'
};
const errorBoxStyle = {
  backgroundColor: 'rgba(255, 0, 85, 0.1)',
  border: '1px solid #ff0055',
  color: '#ff0055',
  padding: '10px 14px',
  borderRadius: '6px',
  marginBottom: '16px',
  fontSize: '0.85rem'
};

export default AddStationForm;