const express = require('express');
const router = express.Router();
const { calculateDispersion } = require('../src/eco/v7/ond86');
const { validateDispersionInput } = require('../src/eco/v7/validation');
const ond86Norms = require('../src/eco/norms/ond86.json');
const gdkNorms = require('../src/eco/norms/gdk.json');

// GET /api/v7/defaults — стартові параметри джерела та довідники
router.get('/defaults', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      default_source: ond86Norms.default_source_kyiv,
      regions: ond86Norms.regions,
      substances: gdkNorms.substances
    }
  });
});

// POST /api/v7/dispersion — розрахунок розсіювання викидів за ОНД-86
router.post('/dispersion', (req, res) => {
  const validation = validateDispersionInput(req.body);

  if (!validation.ok) {
    return res.status(422).json({
      success: false,
      error: 'Помилка валідації вхідних даних',
      fields: validation.errors
    });
  }

  try {
    const result = calculateDispersion(validation.data);
    return res.status(200).json({
      success: true,
      data: result.data,
      passport: result.passport
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Помилка розрахунку ОНД-86: ' + err.message
    });
  }
});

module.exports = router;