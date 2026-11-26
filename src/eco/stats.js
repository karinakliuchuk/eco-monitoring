const Measurement = require('../../models/Measurement');
const DailyStat = require('../../models/DailyStat');
const gdkNorms = require('./norms/gdk.json');

/**
 * Чиста функція обчислення добового середнього з контролем повноти (≥ 18 з 24 год)
 */
function dailyMean(hourlyValues, { minHours = 18 } = {}) {
  const valid = hourlyValues.filter((v) => Number.isFinite(v));
  if (valid.length < minHours) {
    return { value: null, n: valid.length, complete: false };
  }
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return {
    value: Number((sum / valid.length).toFixed(3)),
    n: valid.length,
    complete: true
  };
}

/**
 * Обчислення та збереження добових агрегатів (включно з ковзним 8-год середнім) у daily_stats
 */
async function computeAndSaveDailyStats(stationId, year) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  // 1. Базова добова агрегація за місцевим часом Europe/Kyiv
  const dailyAgg = await Measurement.aggregate([
    {
      $match: {
        station_id: stationId,
        quality: 'valid',
        measurement_time: { $gte: from, $lt: to }
      }
    },
    { $unwind: '$pollutants' },
    {
      $group: {
        _id: {
          day: {
            $dateTrunc: {
              date: '$measurement_time',
              unit: 'day',
              timezone: 'Europe/Kyiv'
            }
          },
          pollutant: '$pollutants.pollutant'
        },
        rawMean: { $avg: '$pollutants.value' },
        max: { $max: '$pollutants.value' },
        hours: { $sum: 1 }
      }
    },
    {
      $addFields: {
        complete: { $gte: ['$hours', 18] }
      }
    },
    { $sort: { '_id.day': 1 } }
  ]);

  // 2. Ковзне 8-годинне середнє для CO та O3 через $setWindowFields
  const rollingAgg = await Measurement.aggregate([
    {
      $match: {
        station_id: stationId,
        quality: 'valid',
        measurement_time: { $gte: from, $lt: to }
      }
    },
    { $unwind: '$pollutants' },
    { $match: { 'pollutants.pollutant': { $in: ['CO', 'O3'] } } },
    {
      $setWindowFields: {
        partitionBy: '$pollutants.pollutant',
        sortBy: { measurement_time: 1 },
        output: {
          rolling8h: {
            $avg: '$pollutants.value',
            window: { range: [-7, 0], unit: 'hour' }
          },
          windowCount: {
            $count: {},
            window: { range: [-7, 0], unit: 'hour' }
          }
        }
      }
    },
    // За Директивою 2008/50/ЄС 8-год середнє валідне за наявності ≥ 6 годин (75%)
    { $match: { windowCount: { $gte: 6 } } },
    {
      $group: {
        _id: {
          day: {
            $dateTrunc: {
              date: '$measurement_time',
              unit: 'day',
              timezone: 'Europe/Kyiv'
            }
          },
          pollutant: '$pollutants.pollutant'
        },
        maxRolling8h: { $max: '$rolling8h' }
      }
    }
  ]);

  const rollingMap = new Map();
  for (const r of rollingAgg) {
    const key = `${r._id.day.toISOString()}_${r._id.pollutant}`;
    rollingMap.set(key, Number(r.maxRolling8h.toFixed(3)));
  }

  // Підготовка документів для bulkWrite у daily_stats
  const bulkOps = dailyAgg.map((item) => {
    const day = item._id.day;
    const pollutant = item._id.pollutant;
    const key = `${day.toISOString()}_${pollutant}`;
    const isComplete = item.complete;

    return {
      updateOne: {
        filter: { station_id: stationId, day, pollutant },
        update: {
          $set: {
            mean: isComplete ? Number(item.rawMean.toFixed(3)) : null,
            max: Number(item.max.toFixed(3)),
            max_rolling_8h: rollingMap.get(key) ?? null,
            hours: item.hours,
            complete: isComplete
          }
        },
        upsert: true
      }
    };
  });

  if (bulkOps.length > 0) {
    await DailyStat.bulkWrite(bulkOps);
  }

  return bulkOps.length;
}

/**
 * Річна описова статистика (середнє, медіана, min/max, P90.4, P98, дні перевищень)
 * та фонові концентрації Cф (P95 за Порядком № 286)
 */
async function getAnnualStats(stationId, year) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const totalDaysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;

  // Агрегація по повних добах з daily_stats (MongoDB 7.0+: $median, $percentile)
  const dailySummary = await DailyStat.aggregate([
    {
      $match: {
        station_id: stationId,
        day: { $gte: from, $lt: to },
        complete: true,
        mean: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$pollutant',
        validDays: { $sum: 1 },
        annualMean: { $avg: '$mean' },
        minDaily: { $min: '$mean' },
        maxDaily: { $max: '$mean' },
        medianDaily: {
          $median: { input: '$mean', method: 'approximate' }
        },
        percentiles: {
          $percentile: {
            input: '$mean',
            p: [0.904, 0.98],
            method: 'approximate'
          }
        },
        dailyMeans: { $push: '$mean' },
        dailyRolling8h: { $push: '$max_rolling_8h' }
      }
    }
  ]);

  // Агрегація годинних значень для обчислення фонової концентрації Cф (P95) за Порядком № 286
  const hourlyBackground = await Measurement.aggregate([
    {
      $match: {
        station_id: stationId,
        quality: 'valid',
        measurement_time: { $gte: from, $lt: to }
      }
    },
    { $unwind: '$pollutants' },
    {
      $group: {
        _id: '$pollutants.pollutant',
        p95: {
          $percentile: {
            input: '$pollutants.value',
            p: [0.95],
            method: 'approximate'
          }
        },
        validHours: { $sum: 1 }
      }
    }
  ]);

  const bgMap = new Map();
  for (const h of hourlyBackground) {
    bgMap.set(h._id, {
      c_background: Number(h.p95[0].toFixed(3)),
      validHours: h.validHours
    });
  }

  // Підрахунок відкинутих (invalid) вимірювань за рік для звітності
  const invalidCount = await Measurement.countDocuments({
    station_id: stationId,
    quality: 'invalid',
    measurement_time: { $gte: from, $lt: to }
  });

  const results = {};

  for (const item of dailySummary) {
    const pollutant = item._id;
    const norm = gdkNorms.substances[pollutant] || {};
    const completenessPct = Number(((item.validDays / totalDaysInYear) * 100).toFixed(1));
    const isAnnualComplete = completenessPct >= 90;

    // Підрахунок діб із перевищенням добового нормативу (або 8-год для CO/O3)
    let exceedanceDays = 0;
    if (pollutant === 'CO' || pollutant === 'O3') {
      const limit = norm.limit_8h || norm.gdk_sd;
      exceedanceDays = item.dailyRolling8h.filter((v) => v !== null && v > limit).length;
    } else if (norm.gdk_sd) {
      exceedanceDays = item.dailyMeans.filter((v) => v > norm.gdk_sd).length;
    }

    const bgInfo = bgMap.get(pollutant) || { c_background: null, validHours: 0 };

    results[pollutant] = {
      pollutant,
      name: norm.name || pollutant,
      unit: norm.unit || 'ug/m3',
      valid_days: item.validDays,
      completeness_pct: completenessPct,
      complete_90pct: isAnnualComplete,
      annual_mean: isAnnualComplete ? Number(item.annualMean.toFixed(3)) : null,
      raw_annual_mean: Number(item.annualMean.toFixed(3)), // навіть якщо <90%, для довідки
      median: Number(item.medianDaily.toFixed(3)),
      min: Number(item.minDaily.toFixed(3)),
      max: Number(item.maxDaily.toFixed(3)),
      p90_4: Number(item.percentiles[0].toFixed(3)),
      p98: Number(item.percentiles[1].toFixed(3)),
      exceedance_days: exceedanceDays,
      gdk_sd: norm.gdk_sd ?? null,
      gdk_mr: norm.gdk_mr ?? null,
      c_background_p95: bgInfo.c_background 
    };
  }

  return {
    station_id: stationId,
    year,
    invalid_records_excluded: invalidCount,
    pollutants: results
  };
}

module.exports = {
  dailyMean,
  computeAndSaveDailyStats,
  getAnnualStats
};