const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  station_id: { type: String, required: true, unique: true, trim: true }, 
  station_name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  population: { type: Number, required: true, min: 0 }, // чисельність населення
  settlement_type: { 
    type: String, 
    required: true, 
    enum: ['city', 'town', 'village', 'resort', 'industrial'] // тип населеного пункту
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('Station', stationSchema);