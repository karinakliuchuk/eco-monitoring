const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  station_id: { type: String, required: true, index: true },
  pollutant: { type: String, required: true },
  period: { type: String, enum: ['1h', '24h', '8h'], required: true }, // ГДК м.р. / ГДК с.д. / 8-год
  measured_at: { type: Date, required: true },
  value: { type: Number, required: true },
  norm_value: { type: Number, required: true },
  ratio_k: { type: Number, required: true } // K = C / ГДК (> 1)
}, { collection: 'alerts', timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);