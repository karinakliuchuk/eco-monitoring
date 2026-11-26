// Молярні маси (г/моль) та фізичні межі сенсорів
const MOLAR_MASS = {
  NO2: 46.01,
  SO2: 64.07,
  O3: 48.00,
  CO: 28.01
};

const PHYSICAL_LIMITS = {
  'PM2.5': { min: 0, max: 1000, unit: 'ug/m3' },
  'PM10':  { min: 0, max: 2000, unit: 'ug/m3' },
  'NO2':   { min: 0, max: 2000, unit: 'ug/m3' },
  'SO2':   { min: 0, max: 3000, unit: 'ug/m3' },
  'O3':    { min: 0, max: 1000, unit: 'ug/m3' },
  'CO':    { min: 0, max: 100,  unit: 'mg/m3' }
};

/**
 * Перерахунок концентрації з ppb у мкг/м³ (для CO — у мг/м³) за 25 °C (Vm = 24.45 л/моль)
 */
function ppbToMassConcentration(ppb, pollutant) {
  const M = MOLAR_MASS[pollutant];
  if (!M || !Number.isFinite(ppb)) return null;
  const ugPerM3 = (ppb * M) / 24.45;
  // Для CO стандартна одиниця в системі — мг/м³ (ділимо на 1000)
  return pollutant === 'CO'
    ? Number((ugPerM3 / 1000).toFixed(4))
    : Number(ugPerM3.toFixed(2));
}

/**
 * Перевірка коректності одного вимірювання речовини
 */
function validateReading(pollutant, value, unit = 'ug/m3') {
  const limits = PHYSICAL_LIMITS[pollutant];
  if (!limits) {
    return { valid: false, reason: `Невідома речовина: ${pollutant}` };
  }
  if (!Number.isFinite(value)) {
    return { valid: false, reason: `${pollutant}: значення не є числом` };
  }

  let normalizedValue = value;
  if (unit === 'ppb') {
    normalizedValue = ppbToMassConcentration(value, pollutant);
  } else if (pollutant === 'CO' && unit === 'ug/m3') {
    normalizedValue = value / 1000;
  }

  if (normalizedValue < limits.min) {
    return { valid: false, value: normalizedValue, reason: `${pollutant} < ${limits.min} (від'ємне значення)` };
  }
  if (normalizedValue > limits.max) {
    return { valid: false, value: normalizedValue, reason: `${pollutant} > ${limits.max} (перевищення фізичної межі)` };
  }

  return { valid: true, value: normalizedValue, unit: limits.unit };
}

module.exports = {
  MOLAR_MASS,
  PHYSICAL_LIMITS,
  ppbToMassConcentration,
  validateReading
};