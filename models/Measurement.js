const mongoose = require('mongoose');

const pollutantReadingSchema = new mongoose.Schema({
  pollutant: { 
    type: String, 
    required: true, 
    enum: ['PM2.5', 'PM10', 'NO2', 'SO2', 'O3', 'CO'] 
  },
  value: { type: Number, required: true }, // мкг/м³ (для CO — мг/м³)
  unit: { type: String, default: 'ug/m3' }
}, { _id: false });

const measurementSchema = new mongoose.Schema({
  station_id: { type: String, required: true, index: true },
  measurement_time: { type: Date, required: true, index: true }, // зберігається в UTC
  quality: { 
    type: String, 
    enum: ['valid', 'suspect', 'invalid'], 
    default: 'valid',
    index: true
  },
  invalid_reasons: [{ type: String }], 
  pollutants: [pollutantReadingSchema]
});

// Складений індекс для швидких агрегацій за станцією та часом
measurementSchema.index({ station_id: 1, measurement_time: 1 });

module.exports = mongoose.model('Measurement', measurementSchema);