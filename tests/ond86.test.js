import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  calculateDispersion,
  resolveSedimentationF,
  calcM,
  calcN,
  calcS1
} = require('../src/eco/v7/ond86');

describe('Частина Б (Варіант 7 — ОНД-86): чисті функції розсіювання', () => {
  it('збігається з ручним розрахунком для контрольної речовини NO2 (до 3 значущих цифр)', () => {
    const { data, passport } = calculateDispersion({
      H: 40,
      D: 1.2,
      w0: 8.0,
      T_gas: 135,
      T_air: 25.6,
      A: 180,
      eta: 1,
      cleaning_efficiency: 92,
      emissions: [
        { pollutant: 'NO2', M: 12.0, background_mg_m3: 0.045 }
      ]
    });

    const p = data.source_params;
    const no2 = data.results[0];

    expect(p.V1_m3_s).toBeCloseTo(9.0478, 3);
    expect(p.deltaT_c).toBeCloseTo(109.4, 1);
    expect(p.f).toBeCloseTo(0.4388, 3);
    expect(p.vm_m_s).toBeCloseTo(1.8941, 3);
    expect(p.vm_prime_m_s).toBeCloseTo(0.312, 3);
    expect(p.m).toBeCloseTo(1.0054, 3);
    expect(p.n).toBeCloseTo(1.0042, 3);
    expect(p.d).toBeCloseTo(11.3709, 2);

    expect(no2.Cm_mg_m3).toBeCloseTo(0.1368, 3);
    expect(no2.Xm_m).toBeCloseTo(454.84, 0);
    expect(no2.total_mg_m3).toBeCloseTo(0.1818, 3);
    expect(no2.gdk_mr_mg_m3).toBe(0.2);
    expect(no2.exceeded).toBe(false);

    const lastPoint = no2.profile[no2.profile.length - 1];
    expect(lastPoint.x_to_xm).toBe(10);
    expect(lastPoint.x_m).toBeCloseTo(4548.4, 0);
    expect(passport.method).toContain('ОНД-86');
    expect(passport.norms_version).toBe('2026-01-01');
  });

  it('фіксує перевищення нормативу, коли Cm + Cф > ГДК м.р.', () => {
    const { data } = calculateDispersion({
      H: 40,
      D: 1.2,
      w0: 8.0,
      T_gas: 135,
      T_air: 25.6,
      A: 180,
      eta: 1,
      emissions: [
        { pollutant: 'NO2', M: 20.0, background_mg_m3: 0.08 }
      ]
    });

    const no2 = data.results[0];
    expect(no2.total_mg_m3).toBeGreaterThan(no2.gdk_mr_mg_m3);
    expect(no2.exceeded).toBe(true);
    expect(no2.gdk_ratio).toBeGreaterThan(1);
  });

  it('коректно визначає коефіцієнт F залежно від типу речовини та ступеня очищення', () => {
    expect(resolveSedimentationF('gas', 0)).toBe(1);
    expect(resolveSedimentationF('dust', 95)).toBe(2);
    expect(resolveSedimentationF('dust', 80)).toBe(2.5);
    expect(resolveSedimentationF('dust', 50)).toBe(3);
  });

  it('коректно обробляє граничні гілки формул m, n та s1', () => {
    expect(calcM(125)).toBeCloseTo(1.47 / 5, 4);
    expect(calcN(10, 2.5, 1.0)).toBe(1);
    expect(calcN(10, 0.25, 1.0)).toBeCloseTo(1.1, 4);
    expect(calcS1(0, 1)).toBe(0);
    expect(calcS1(1, 1)).toBe(1);
    expect(calcS1(10, 1)).toBeCloseTo(10 / (358 - 352 + 120), 4);
  });
});