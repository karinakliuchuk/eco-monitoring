require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Імпорт маршрутів якості повітря (ЛР 1-2), екологічної статистики (ЛР 3 Ч.А) та ОНД-86 (ЛР 3 Ч.Б)
const airQualityRoutes = require('./routes/airQualityRoutes');
const ecoStatsRoutes = require('./routes/ecoStatsRoutes');
const v7Routes = require('./routes/v7Routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Підключення до MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/eco_monitoring';

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB успішно підключено!'))
  .catch((err) => console.error('Помилка підключення до MongoDB:', err));

// Базовий роут для перевірки
app.get('/', (req, res) => {
  res.json({ message: 'Eco Monitoring API працює!' });
});

// Підключення маршрутів
app.use('/api/airquality', airQualityRoutes);
app.use('/api/eco', ecoStatsRoutes);
app.use('/api/v7', v7Routes);

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
  });
}

module.exports = app;