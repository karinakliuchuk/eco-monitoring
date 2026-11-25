import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ppbToMassConcentration, validateReading } = require('../src/eco/units');
const { dailyMean } = require('../src/eco/stats');
const { checkExceedance } = require('../src/eco/compare');
const { calculateUkraineAQI, calculateAnnualIZA } = require('../src/eco/indices');

describe('Частина А: Одиниці вимірювання та валідація (units.js)', () => {
  it('коректно перераховує NO2 з ppb у мкг/м³ за 25 °C', () => {
    // 100 ppb * 46.01 / 24.45 ≈ 188.18 мкг/м³
    expect(ppbToMassConcentration(100, 'NO2')).toBeCloseTo(188.18, 1);
  });

  it('відсіює відʼємні значення та вихід за фізичні межі', () => {
    expect(validateReading('PM2.5', -5).valid).toBe(false);
    expect(validateReading('NO2', 2500).valid).toBe(false);
    expect(validateReading('PM10', 45.5).valid).toBe(true);
  });
});

describe('Частина А: Добові агрегати та ГДК (stats.js, compare.js)', () => {
  it('повертає complete: false, якщо валідних годин менше 18 (< 75%)', () => {
    const res = dailyMean(Array(17).fill(20));
    expect(res.complete).toBe(false);
    expect(res.value).toBeNull();
  });

  it('обчислює добове середнє при ≥ 18 годинах спостережень', () => {
    const res = dailyMean([10, 20, 30, ...Array(15).fill(20)]);
    expect(res.complete).toBe(true);
    expect(res.value).toBe(20);
  });

  it('фіксує перевищення ГДК при K > 1', () => {
    expect(checkExceedance(40, 35)).toEqual({ exceeded: true, ratio: 1.143 });
    expect(checkExceedance(35, 35)).toEqual({ exceeded: false, ratio: 1 });
  });
});

describe('Частина А: Індекс № 590 та річний ІЗА (indices.js)', () => {
  it('визначає категорію за найгіршою речовиною та позначає неповноту набору', () => {
    const aqi = calculateUkraineAQI([
      { pollutant: 'PM2.5', value: 25.1 }, // рівень 4 — Погано
      { pollutant: 'NO2', value: 30 }     // рівень 1 — Добре
    ]);
    expect(aqi.overall.level).toBe(4);
    expect(aqi.overall.name).toBe('Погано');
    expect(aqi.incomplete).toBe(true);
  });

  it('розраховує річний ІЗА з урахуванням класів небезпечності', () => {
    const iza = calculateAnnualIZA({
      SO2: { annual_mean: 50 }, // (50/50)^1.0 = 1.0
      NO2: { annual_mean: 40 }  // (40/40)^1.3 = 1.0
    });
    expect(iza.iza).toBe(2);
    expect(iza.level).toBe('Низький');
  });
});
