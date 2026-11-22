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
    trim: true,
    match: [
      /^[а-яА-ЯіїєґІЇЄҐa-zA-Z\s'’-]+$/,
      'Назва міста може містити лише літери, пробіли, дефіс або апостроф'
    ]
  },
  location: {
    latitude: {
      type: Number,
      required: true,
      min: [-90, 'Широта не може бути меншою за -90'],
      max: [90, 'Широта не може бути більшою за 90']
    },
    longitude: {
      type: Number,
      required: true,
      min: [-180, 'Довгота не може бути меншою за -180'],
      max: [180, 'Довгота не може бути більшою за 180']
    }
  },
  pollutants: {
    pm25: {
      type: Number,
      required: true,
      min: [0, 'PM2.5 не може бути від\'ємним']
    },
    pm10: {
      type: Number,
      min: [0, 'PM10 не може бути від\'ємним']
    },
    no2: {
      type: Number,
      min: [0, 'NO2 не може бути від\'ємним']
    }
  },
  measured_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AirQuality', airQualitySchema);