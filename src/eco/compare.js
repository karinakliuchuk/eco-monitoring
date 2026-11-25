const Measurement = require('../../models/Measurement');
const DailyStat = require('../../models/DailyStat');
const Alert = require('../../models/Alert');
const gdkNorms = require('./norms/gdk.json');

/**
 * Чиста функція перевірки перевищення нормативу
 */
function checkExceedance(value, normValue) {
  if (!Number.isFinite(value) || !Number.isFinite(normValue) || normValue <= 0) {
    return { exceeded: false, ratio: null };
  }
  const ratio = Number((value / normValue).toFixed(3));
  return {
    exceeded: ratio > 1,
    ratio
  };
}

/**
 * Пошук усіх перевищень ГДК м.р. (1 год) та ГДК с.д. (24 год) за рік і запис в alerts
 */
async function evaluateExceedancesAndSaveAlerts(stationId, year) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  // Очищаємо попередні алерти для цієї станції та року перед перерахунком
  await Alert.deleteMany({
    station_id: stationId,
    measured_at: { $gte: from, $lt: to }
  });

  const alertsToInsert = [];

  // 1. Перевірка годинних значень проти ГДК м.р.
  const measurements = await Measurement.find({
    station_id: stationId,
    quality: 'valid',
    measurement_time: { $gte: from, $lt: to }
  }).lean();

  for (const m of measurements) {
    for (const p of m.pollutants) {
      const norm = gdkNorms.substances[p.pollutant];
      if (!norm || !norm.gdk_mr) continue;

      const { exceeded, ratio } = checkExceedance(p.value, norm.gdk_mr);
      if (exceeded) {
        alertsToInsert.push({
          station_id: stationId,
          pollutant: p.pollutant,
          period: '1h',
          measured_at: m.measurement_time,
          value: p.value,
          norm_value: norm.gdk_mr,
          ratio_k: ratio
        });
      }
    }
  }

  // 2. Перевірка повних добових середніх проти ГДК с.д.
  const dailyStats = await DailyStat.find({
    station_id: stationId,
    day: { $gte: from, $lt: to },
    complete: true,
    mean: { $ne: null }
  }).lean();

  for (const d of dailyStats) {
    const norm = gdkNorms.substances[d.pollutant];
    if (!norm || !norm.gdk_sd) continue;

    const { exceeded, ratio } = checkExceedance(d.mean, norm.gdk_sd);
    if (exceeded) {
      alertsToInsert.push({
        station_id: stationId,
        pollutant: d.pollutant,
        period: '24h',
        measured_at: d.day,
        value: d.mean,
        norm_value: norm.gdk_sd,
        ratio_k: ratio
      });
    }
  }

  if (alertsToInsert.length > 0) {
    await Alert.insertMany(alertsToInsert);
  }

  return {
    total_alerts: alertsToInsert.length,
    hourly_alerts: alertsToInsert.filter((a) => a.period === '1h').length,
    daily_alerts: alertsToInsert.filter((a) => a.period === '24h').length
  };
}

module.exports = {
  checkExceedance,
  evaluateExceedancesAndSaveAlerts
};