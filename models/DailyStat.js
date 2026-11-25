const mongoose = require('mongoose');

const dailyStatSchema = new mongoose.Schema({
  station_id: { type: String, required: true, index: true },
  day: { type: Date, required: true }, // початок доби за Europe/Kyiv
  pollutant: { type: String, required: true },
  mean: { type: Number, default: null }, // null, якщо повнота < 75% (< 18 год)
  max: { type: Number, default: null },
  max_rolling_8h: { type: Number, default: null }, // для CO та O3
  hours: { type: Number, required: true },
  complete: { type: Boolean, required: true } // true, якщо hours >= 18
}, { collection: 'daily_stats' });

dailyStatSchema.index({ station_id: 1, day: 1, pollutant: 1 }, { unique: true });

module.exports = mongoose.model('DailyStat', dailyStatSchema);