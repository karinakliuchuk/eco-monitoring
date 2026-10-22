require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Імпорт маршрутів якості повітря
const airQualityRoutes = require('./routes/airQualityRoutes');

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

// Підключення маршрутів для CRUD-операцій якості повітря
app.use('/api/airquality', airQualityRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});