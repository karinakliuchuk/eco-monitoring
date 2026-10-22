const express = require('express');
const router = express.Router();
const AirQuality = require('../models/AirQuality'); 

// 1. CREATE: Створення нового запису (POST /api/airquality)
router.post('/', async (req, res) => {
  try {
    const { station_name, city, location, pollutants, measured_at } = req.body;

    // Перевірка наявності обов'язкових даних (400 Bad Request)
    if (
      !station_name ||
      !city ||
      !location ||
      location.latitude === undefined ||
      location.longitude === undefined ||
      !pollutants ||
      pollutants.pm25 === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: 'Відсутні обов\'язкові поля (station_name, city, location.latitude, location.longitude, pollutants.pm25)'
      });
    }

    const newRecord = new AirQuality({
      station_name,
      city,
      location,
      pollutants,
      measured_at
    });

    const savedRecord = await newRecord.save();

    // 201 Created
    res.status(201).json({
      success: true,
      message: 'Запис про якість повітря успішно створено',
      data: savedRecord
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    // 500 Internal Server Error
    res.status(500).json({
      success: false,
      error: 'Помилка сервера при створенні запису: ' + error.message
    });
  }
});

// 2. READ ALL: Отримання всіх записів (GET /api/airquality)
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;
    const filter = {};

    // Опціональна фільтрація за містом, якщо передано query-параметр ?city=Київ
    if (city) {
      filter.city = { $regex: city,$options: 'i' };
    }

    const records = await AirQuality.find(filter).sort({ measured_at: -1 });

    // 200 OK
    res.status(200).json({
      success: true,
      meta: { count: records.length },
      data: records
    });
  } catch (error) {
    // 500 Internal Server Error
    res.status(500).json({
      success: false,
      error: 'Помилка сервера при отриманні даних: ' + error.message
    });
  }
});

// 3. READ ONE: Отримання одного запису за ID (GET /api/airquality/:id)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AirQuality.findById(id);

    // Якщо запис не знайдено — 404 Not Found
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Запис із ID ${id} не знайдено`
      });
    }

    // 200 OK
    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    // Якщо передано некоректний формат MongoDB ObjectId — 400 Bad Request
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Некоректний формат ID запису'
      });
    }
    // 500 Internal Server Error
    res.status(500).json({
      success: false,
      error: 'Помилка сервера при пошуку запису: ' + error.message
    });
  }
});

// 4. UPDATE: Оновлення запису за ID (PUT /api/airquality/:id)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Перевірка, чи передано тіло запиту для оновлення
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Дані для оновлення відсутні'
      });
    }

    const updatedRecord = await AirQuality.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true } // повертає оновлений документ і перевіряє схему
    );

    // Якщо запис не знайдено — 404 Not Found
    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        error: `Запис із ID ${id} не знайдено для оновлення`
      });
    }

    // 200 OK
    res.status(200).json({
      success: true,
      message: 'Запис успішно оновлено',
      data: updatedRecord
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Некоректні дані або формат ID: ' + error.message
      });
    }
    // 500 Internal Server Error
    res.status(500).json({
      success: false,
      error: 'Помилка сервера при оновленні запису: ' + error.message
    });
  }
});

// 5. DELETE: Видалення запису за ID (DELETE /api/airquality/:id)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRecord = await AirQuality.findByIdAndDelete(id);

    // Якщо запис не знайдено — 404 Not Found
    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        error: `Запис із ID ${id} не знайдено для видалення`
      });
    }

    // 200 OK
    res.status(200).json({
      success: true,
      message: 'Запис успішно видалено',
      data: deletedRecord
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Некоректний формат ID запису'
      });
    }
    // 500 Internal Server Error
    res.status(500).json({
      success: false,
      error: 'Помилка сервера при видаленні запису: ' + error.message
    });
  }
});

module.exports = router;