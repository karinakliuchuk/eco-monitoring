const mongoose = require('mongoose');

const airQualitySchema = new mongoose.Schema({
  station_name: {
    type: String,
    required: [true, 'Назва станції обов\'язкова'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'Місто обов\'язкове'],
    trim: true
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  pollutants: {
    pm25: { type: Number, required: true },
    pm10: { type: Number },
    no2: { type: Number }
  },
  measured_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AirQuality', airQualitySchema);