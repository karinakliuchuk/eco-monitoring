require('dotenv').config();
const mongoose = require('mongoose');
const Station = require('../models/Station');
const Measurement = require('../models/Measurement');

// Парсинг аргументів командного рядка: --station KYIV-01 --year 2025
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const STATION_ID = getArg('--station', 'KYIV-01');
const YEAR = parseInt(getArg('--year', '2025'), 10);

// Фізичні межі сенсорів (мкг/м³, для CO — мг/м³)
const PHYSICAL_LIMITS = {
  'PM2.5': { max: 1000, unit: 'ug/m3' },
  'PM10':  { max: 2000, unit: 'ug/m3' },
  'NO2':   { max: 2000, unit: 'ug/m3' },
  'SO2':   { max: 3000, unit: 'ug/m3' },
  'O3':    { max: 1000, unit: 'ug/m3' },
  'CO':    { max: 100,  unit: 'mg/m3' }
};

// Базові рівні концентрацій для реалістичної генерації
const BASE_LEVELS = {
  'PM2.5': 18,
  'PM10':  32,
  'NO2':   35,
  'SO2':   12,
  'O3':    45,
  'CO':    0.8
};

const randomNormal = (mean, std) => {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
};

async function generateYearData() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/eco_monitoring';
  await mongoose.connect(mongoUri);
  console.log('Підключено до MongoDB...');

  // 1. Створюємо або оновлюємо станцію моніторингу
  await Station.findOneAndUpdate(
    { station_id: STATION_ID },
    {
      station_id: STATION_ID,
      station_name: 'Київ — Пост моніторингу №1 (КПІ)',
      city: 'Київ',
      population: 2952301,
      settlement_type: 'city',
      location: { latitude: 50.4495, longitude: 30.4564 }
    },
    { upsert: true, new: true }
  );
  console.log(`Станцію ${STATION_ID} збережено.`);

  // Очищаємо старі вимірювання цієї станції за вказаний рік
  const startDate = new Date(Date.UTC(YEAR, 0, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(YEAR + 1, 0, 1, 0, 0, 0));
  await Measurement.deleteMany({
    station_id: STATION_ID,
    measurement_time: { $gte: startDate, $lt: endDate }
  });

  const totalHours = 8760; // стандартний невисокосний рік (365 * 24)

  // Визначаємо 2 багатоденні блоки пропусків (по 48 годин)
  const blockGaps = [
    { start: 1400, end: 1448 }, // кінець лютого
    { start: 5100, end: 5148 }  // серпень
  ];

  // Визначаємо 4 епізоди пікових забруднень (по 12-18 годин кожен)
  const peakEpisodes = [
    { start: 420,  end: 436,  multiplier: 4.5 }, // зимовий смог
    { start: 2600, end: 2614, multiplier: 3.8 }, // весняний пік
    { start: 4800, end: 4818, multiplier: 3.5 }, // літній фотохімічний пік
    { start: 7900, end: 7916, multiplier: 4.8 }  // листопадовий інверсійний пік
  ];

  // Визначаємо фіксовані години для ін'єкції invalid-значень (15 випадків)
  const invalidHours = new Set([105, 512, 980, 1650, 2100, 2999, 3450, 4120, 4670, 5500, 6123, 6789, 7200, 8010, 8555]);

  const records = [];
  let missingCount = 0;

  for (let h = 0; h < totalHours; h++) {
    const currentTime = new Date(startDate.getTime() + h * 3600 * 1000);
    const hourOfDay = currentTime.getUTCHours();
    const dayOfYear = Math.floor(h / 24);

    // Перевірка на багатоденні блоки пропусків або ~7% випадкових пропусків годин
    const inBlockGap = blockGaps.some((g) => h >= g.start && h < g.end);
    if (inBlockGap || (!invalidHours.has(h) && Math.random() < 0.07)) {
      missingCount++;
      continue;
    }

    // Сезонний коефіцієнт (взимку вищий для опалення, влітку вищий для O3)
    const seasonAngle = (2 * Math.PI * dayOfYear) / 365;
    const winterFactor = 1 + 0.35 * Math.cos(seasonAngle);
    const summerFactor = 1 - 0.4 * Math.cos(seasonAngle);

    // Добовий цикл (піки о 08:00 та 19:00)
    const trafficFactor =
      1 + 0.3 * Math.exp(-Math.pow((hourOfDay - 8) / 2.5, 2)) +
      0.35 * Math.exp(-Math.pow((hourOfDay - 19) / 3, 2));

    // Перевірка на піковий епізод
    const activePeak = peakEpisodes.find((p) => h >= p.start && h <= p.end);
    const peakMult = activePeak ? activePeak.multiplier : 1;

    const pollutants = [];
    let quality = 'valid';
    const invalidReasons = [];

    for (const [name, base] of Object.entries(BASE_LEVELS)) {
      const season = name === 'O3' ? summerFactor : winterFactor;
      let val = randomNormal(base * season * trafficFactor * peakMult, base * 0.2);
      val = Math.max(0.1, Number(val.toFixed(name === 'CO' ? 3 : 2)));

      pollutants.push({
        pollutant: name,
        value: val,
        unit: PHYSICAL_LIMITS[name].unit
      });
    }

    // Навмисно псуємо 15 записів для перевірки очищення даних
    if (invalidHours.has(h)) {
      quality = 'invalid';
      if (h % 2 === 0) {
        pollutants[0].value = -5.4; // від'ємний PM2.5
        invalidReasons.push('PM2.5 < 0 (відʼємне значення сенсора)');
      } else {
        pollutants[2].value = 4500; // NO2 вище фізичної межі (2000)
        invalidReasons.push('NO2 > 2000 ug/m3 (перевищення фізичної межі)');
      }
    }

    records.push({
      station_id: STATION_ID,
      measurement_time: currentTime,
      quality,
      invalid_reasons: invalidReasons,
      pollutants
    });
  }

  // Пакетна вставка в MongoDB
  await Measurement.insertMany(records);

  console.log('--- Звіт генерації ---');
  console.log(`Рік: ${YEAR} (усього годин: ${totalHours})`);
  console.log(`Збережено записів: ${records.length}`);
  console.log(`Пропущено годин: ${missingCount} (${((missingCount / totalHours) * 100).toFixed(1)}%)`);
  console.log(`Позначено як invalid: ${invalidHours.size}`);

  await mongoose.disconnect();
}

generateYearData().catch((err) => {
  console.error('Помилка генерації:', err);
  process.exit(1);
});