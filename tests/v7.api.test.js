import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('REST API Варіанта 7 (/api/v7) та річні показники (/api/eco)', () => {
  it('POST /api/v7/dispersion повертає 200, результати та паспорт розрахунку', async () => {
    const res = await request(app)
      .post('/api/v7/dispersion')
      .send({
        H: 40,
        D: 1.2,
        w0: 8.0,
        T_gas: 135,
        T_air: 25.6,
        A: 180,
        eta: 1,
        cleaning_efficiency: 92,
        emissions: [
          { pollutant: 'NO2', M: 12.0, background_mg_m3: 0.045 },
          { pollutant: 'SO2', M: 18.5, background_mg_m3: 0.025 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.results[0].Cm_mg_m3).toBeCloseTo(0.1368, 3);
    expect(res.body.passport).toBeDefined();
    expect(res.body.passport.coefficients.m).toBeCloseTo(1.0054, 3);
  });

  it('POST /api/v7/dispersion повертає 422 зі списком помилкових полів при невалідних даних', async () => {
    const res = await request(app)
      .post('/api/v7/dispersion')
      .send({
        H: -5,
        D: 0,
        w0: -2,
        T_gas: 20,
        T_air: 25.6,
        emissions: [
          { pollutant: 'UNKNOWN_GAS', M: -1 }
        ]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.fields)).toBe(true);

    const fieldNames = res.body.fields.map((f) => f.field);
    expect(fieldNames).toContain('H');
    expect(fieldNames).toContain('D');
    expect(fieldNames).toContain('w0');
    expect(fieldNames).toContain('T_gas');
    expect(fieldNames).toContain('emissions.0.pollutant');
    expect(fieldNames).toContain('emissions.0.M');
  });

  it('GET /api/v7/defaults повертає стартові параметри та довідник речовин', async () => {
    const res = await request(app).get('/api/v7/defaults');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.substances.NO2.gdk_mr).toBe(200);
  });

  it('GET /api/eco/stations/KYIV-01/annual повертає річні показники та фонові концентрації Cф (Частина А)', async () => {
    const res = await request(app).get('/api/eco/stations/KYIV-01/annual?year=2025');

    // Станція KYIV-01 має бути заповнена через npm run seed:year
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.station.station_id).toBe('KYIV-01');
    expect(res.body.pollutants).toBeDefined();
    expect(res.body.pollutants.NO2.c_background_p95).toBeGreaterThan(0);
    expect(res.body.iza).toBeDefined();
  });
});