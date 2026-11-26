const aqiUaNorms = require('./norms/aqi-ua.json');
const gdkNorms = require('./norms/gdk.json');

// Показники ступеня k_i залежно від класу небезпечності речовини
const HAZARD_CLASS_EXPONENT = {
  1: 1.7,
  2: 1.3,
  3: 1.0,
  4: 0.9
};

/**
 * Розрахунок погодинного індексу якості повітря за Наказом Міндовкілля № 590
 * @param {Array<{pollutant: string, value: number}>} pollutantsArray
 */
function calculateUkraineAQI(pollutantsArray = []) {
  const required = aqiUaNorms.required_pollutants; // ['PM2.5', 'PM10', 'O3', 'NO2', 'SO2']
  const subIndices = {};
  let maxLevel = 0;

  const readingsMap = new Map();
  for (const item of pollutantsArray) {
    if (required.includes(item.pollutant) && Number.isFinite(item.value)) {
      readingsMap.set(item.pollutant, item.value);
    }
  }

  for (const pollutant of required) {
    const val = readingsMap.get(pollutant);
    if (val === undefined) {
      subIndices[pollutant] = null;
      continue;
    }

    const limits = aqiUaNorms.thresholds[pollutant];
    let level = 6;
    for (let i = 0; i < limits.length; i++) {
      if (val <= limits[i]) {
        level = i + 1;
        break;
      }
    }

    const category = aqiUaNorms.categories.find((c) => c.level === level);
    subIndices[pollutant] = {
      value: val,
      level: category.level,
      code: category.code,
      name: category.name,
      color: category.color
    };

    if (level > maxLevel) {
      maxLevel = level;
    }
  }

  const measuredCount = Object.values(subIndices).filter((v) => v !== null).length;
  const incomplete = measuredCount < required.length;

  const overallCategory = maxLevel > 0
    ? aqiUaNorms.categories.find((c) => c.level === maxLevel)
    : { level: 0, code: 'NO_DATA', name: 'Немає даних', color: '#888888' };

  return {
    standard: aqiUaNorms.meta.source,
    valid_from: aqiUaNorms.meta.valid_from,
    overall: overallCategory,
    incomplete,
    measured_count: measuredCount,
    required_count: required.length,
    sub_indices: subIndices
  };
}

/**
 * Розрахунок річного Індексу забруднення атмосфери (ІЗА)
 * @param {Object} annualPollutantsMap - об'єкт з річними середніми
 */
function calculateAnnualIZA(annualPollutantsMap) {
  let izaSum = 0;
  const components = [];

  for (const [pollutant, stat] of Object.entries(annualPollutantsMap)) {
    const norm = gdkNorms.substances[pollutant];
    const cAnnual = stat.annual_mean ?? stat.raw_annual_mean;

    if (!norm || !norm.gdk_sd || !Number.isFinite(cAnnual)) continue;

    const k = HAZARD_CLASS_EXPONENT[norm.hazard_class] || 1.0;
    const term = Math.pow(cAnnual / norm.gdk_sd, k);
    izaSum += term;

    components.push({
      pollutant,
      c_annual: cAnnual,
      gdk_sd: norm.gdk_sd,
      hazard_class: norm.hazard_class,
      exponent_k: k,
      contribution: Number(term.toFixed(3))
    });
  }

  // Класифікація рівня забруднення за ІЗА
  let levelName = 'Низький';
  if (izaSum >= 14) levelName = 'Дуже високий';
  else if (izaSum >= 7) levelName = 'Високий';
  else if (izaSum >= 5) levelName = 'Підвищений';

  return {
    iza: Number(izaSum.toFixed(2)),
    level: levelName,
    components
  };
}

module.exports = {
  calculateUkraineAQI,
  calculateAnnualIZA
};