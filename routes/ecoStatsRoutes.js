const express = require('express');
const router = express.Router();

const Station = require('../models/Station');
const Measurement = require('../models/Measurement');
const DailyStat = require('../models/DailyStat');
const Alert = require('../models/Alert');

const { computeAndSaveDailyStats, getAnnualStats } = require('../src/eco/stats');
const { evaluateExceedancesAndSaveAlerts } = require('../src/eco/compare');
const { calculateUkraineAQI, calculateAnnualIZA } = require('../src/eco/indices');

// 1. Отримати список усіх станцій
router.get('/stations', async (req, res) => {
  try {
    const stations = await Station.find().lean();
    res.json({ success: true, data: stations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Запустити перерахунок добових агрегатів (daily_stats) та перевищень (alerts) за рік
router.post('/stations/:stationId/process', async (req, res) => {
  try {
    const { stationId } = req.params;
    const year = parseInt(req.query.year || req.body.year || '2025', 10);

    const dailyRecordsSaved = await computeAndSaveDailyStats(stationId, year);
    const alertSummary = await evaluateExceedancesAndSaveAlerts(stationId, year);

    res.json({
      success: true,
      station_id: stationId,
      year,
      daily_stats_upserted: dailyRecordsSaved,
      alerts: alertSummary
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Отримати річні показники станції, ІЗА та фонові концентрації Cф 
router.get('/stations/:stationId/annual', async (req, res) => {
  try {
    const { stationId } = req.params;
    const year = parseInt(req.query.year || '2025', 10);

    const station = await Station.findOne({ station_id: stationId }).lean();
    if (!station) {
      return res.status(404).json({ success: false, message: `Станцію ${stationId} не знайдено` });
    }

    // Якщо daily_stats ще не пораховані — рахуємо автоматично
    const existingCount = await DailyStat.countDocuments({
      station_id: stationId,
      day: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) }
    });
    if (existingCount === 0) {
      await computeAndSaveDailyStats(stationId, year);
    }

    const annualData = await getAnnualStats(stationId, year);
    const izaData = calculateAnnualIZA(annualData.pollutants);

    res.json({
      success: true,
      station,
      year,
      invalid_records_excluded: annualData.invalid_records_excluded,
      iza: izaData,
      pollutants: annualData.pollutants
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Отримати добові агрегати за рік або місяць для графіка (з опційним фільтром ?pollutant=PM2.5)
router.get('/stations/:stationId/daily', async (req, res) => {
  try {
    const { stationId } = req.params;
    const year = parseInt(req.query.year || '2025', 10);
    const { pollutant } = req.query;

    const filter = {
      station_id: stationId,
      day: {
        $gte: new Date(Date.UTC(year, 0, 1)),
        $lt: new Date(Date.UTC(year + 1, 0, 1))
      }
    };
    if (pollutant) {
      filter.pollutant = pollutant;
    }

    const daily = await DailyStat.find(filter).sort({ day: 1 }).lean();
    res.json({ success: true, count: daily.length, data: daily });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Отримати погодинний індекс якості повітря за Наказом № 590 (на момент ?time=... або останню годину)
router.get('/stations/:stationId/aqi', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { time } = req.query;

    let measurement;
    if (time) {
      const targetDate = new Date(time);
      measurement = await Measurement.findOne({
        station_id: stationId,
        quality: 'valid',
        measurement_time: { $lte: targetDate }
      }).sort({ measurement_time: -1 }).lean();
    } else {
      measurement = await Measurement.findOne({
        station_id: stationId,
        quality: 'valid'
      }).sort({ measurement_time: -1 }).lean();
    }

    if (!measurement) {
      return res.status(404).json({ success: false, message: 'Валідних вимірювань не знайдено' });
    }

    const aqiResult = calculateUkraineAQI(measurement.pollutants);

    res.json({
      success: true,
      station_id: stationId,
      measurement_time: measurement.measurement_time,
      aqi: aqiResult
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Отримати журнал перевищень (alerts)
router.get('/stations/:stationId/alerts', async (req, res) => {
  try {
    const { stationId } = req.params;
    const limit = parseInt(req.query.limit || '50', 10);

    const alerts = await Alert.find({ station_id: stationId })
      .sort({ measured_at: -1 })
      .limit(limit)
      .lean();

    const totalCount = await Alert.countDocuments({ station_id: stationId });
    res.json({ success: true, total: totalCount, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;