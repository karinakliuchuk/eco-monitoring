const gdkNorms = require('../norms/gdk.json');
const ond86Norms = require('../norms/ond86.json');

/**
 * Об'ємна витрата газоповітряної суміші V1 (м3/с), ОНД-86, ф. (2.2)
 */
function calcV1(D, w0) {
  return ((Math.PI * D * D) / 4) * w0;
}

/**
 * Різниця температур газів та зовнішнього повітря ΔT (°C)
 */
function calcDeltaT(T_gas, T_air) {
  return T_gas - T_air;
}

/**
 * Безрозмірний параметр f, ОНД-86, ф. (2.3)
 */
function calcFParam(w0, D, H, deltaT) {
  return 1000 * ((w0 * w0 * D) / (H * H * deltaT));
}

/**
 * Параметр vm (м/с), ОНД-86, ф. (2.4а)
 */
function calcVm(V1, deltaT, H) {
  return 0.65 * Math.cbrt((V1 * deltaT) / H);
}

/**
 * Параметр v'm (м/с), ОНД-86, ф. (2.4б)
 */
function calcVmPrime(w0, D, H) {
  return 1.3 * ((w0 * D) / H);
}

/**
 * Безрозмірний коефіцієнт m, ОНД-86, ф. (2.5а–2.5б)
 */
function calcM(f) {
  if (f < 100) {
    return 1 / (0.67 + 0.1 * Math.sqrt(f) + 0.34 * Math.cbrt(f));
  }
  return 1.47 / Math.cbrt(f);
}

/**
 * Безрозмірний коефіцієнт n, ОНД-86, ф. (2.6а–2.6в)
 */
function calcN(f, vm, vmPrime) {
  const v = f < 100 ? vm : vmPrime;
  if (v >= 2) return 1;
  if (v >= 0.5) return 0.532 * v * v - 2.13 * v + 3.13;
  return 4.4 * v;
}

/**
 * Коефіцієнт швидкості осідання F за типом речовини та ступенем очищення (%), ОНД-86, п. 2.5
 */
function resolveSedimentationF(substanceType, cleaningEfficiency = 90) {
  if (substanceType === 'gas') return ond86Norms.sedimentation_F.gas;
  if (cleaningEfficiency >= 90) return ond86Norms.sedimentation_F.dust_cleaning_gte_90;
  if (cleaningEfficiency >= 75) return ond86Norms.sedimentation_F.dust_cleaning_75_to_90;
  return ond86Norms.sedimentation_F.dust_cleaning_lt_75;
}

/**
 * Безрозмірний коефіцієнт d для розрахунку Xm, ОНД-86, ф. (2.13а–2.13в)
 */
function calcD(f, vm, vmPrime) {
  if (f < 100) {
    const fFactor = 1 + 0.28 * Math.cbrt(f);
    if (vm <= 0.5) return 2.48 * fFactor;
    if (vm <= 2) return 4.95 * vm * fFactor;
    return 7 * Math.sqrt(vm) * fFactor;
  }
  if (vmPrime <= 0.5) return 5.7;
  if (vmPrime <= 2) return 11.4 * vmPrime;
  return 16 * Math.sqrt(vmPrime);
}

/**
 * Відстань Xm від джерела до точки максимуму (м), ОНД-86, ф. (2.12)
 */
function calcXm(F, d, H) {
  return ((5 - F) / 4) * d * H;
}

/**
 * Максимальна приземна концентрація Cm (мг/м3), ОНД-86, ф. (2.1)
 */
function calcCm({ A, M, F, m, n, eta = 1, H, V1, deltaT }) {
  return (A * M * F * m * n * eta) / (H * H * Math.cbrt(V1 * deltaT));
}

/**
 * Безрозмірний коефіцієнт s1(x / Xm), ОНД-86, ф. (2.23а–2.23г)
 */
function calcS1(u, F = 1) {
  if (u <= 0) return 0;
  if (u <= 1) {
    return 3 * Math.pow(u, 4) - 8 * Math.pow(u, 3) + 6 * Math.pow(u, 2);
  }
  if (u <= 8) {
    return 1.13 / (0.13 * u * u + 1);
  }
  if (F <= 1.5) {
    return u / (3.58 * u * u - 35.2 * u + 120);
  }
  return 1 / (0.1 * u * u + 2.47 * u - 17.8);
}

/**
 * Побудова профілю концентрацій C(x) по осі факела від 0 до 10 * Xm
 */
function calcProfile(Cm, Xm, F = 1) {
  const multipliers = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return multipliers.map((u) => {
    const x = u * Xm;
    const s1 = calcS1(u, F);
    const cx = s1 * Cm;
    return {
      x_to_xm: Number(u.toFixed(2)),
      x_m: Number(x.toFixed(2)),
      s1: Number(s1.toFixed(4)),
      c_mg_m3: Number(cx.toFixed(5)),
      c_ug_m3: Number((cx * 1000).toFixed(2))
    };
  });
}

/**
 * Отримання ГДК м.р. у мг/м3 із спільного довідника gdk.json (де речовини можуть бути в ug/m3 або mg/m3)
 */
function getGdkMrInMgM3(norm) {
  if (!norm || !Number.isFinite(norm.gdk_mr)) return null;
  return norm.unit === 'ug/m3' ? norm.gdk_mr / 1000 : norm.gdk_mr;
}

/**
 * Повний розрахунок розсіювання викидів точкового джерела за ОНД-86 (Варіант 7)
 */
function calculateDispersion(input) {
  const {
    H,
    D,
    w0,
    T_gas,
    T_air = ond86Norms.regions.Kyiv.T_air_max_avg_c,
    A = ond86Norms.regions.Kyiv.A,
    eta = 1,
    cleaning_efficiency = 90,
    emissions
  } = input;

  const deltaT = calcDeltaT(T_gas, T_air);
  const V1 = calcV1(D, w0);
  const f = calcFParam(w0, D, H, deltaT);
  const vm = calcVm(V1, deltaT, H);
  const vmPrime = calcVmPrime(w0, D, H);
  const m = calcM(f);
  const n = calcN(f, vm, vmPrime);
  const d = calcD(f, vm, vmPrime);

  const results = emissions.map((item) => {
    const norm = gdkNorms.substances[item.pollutant];
    const substanceType = ond86Norms.substance_types[item.pollutant] || 'gas';
    const F = item.F !== undefined
      ? item.F
      : resolveSedimentationF(substanceType, cleaning_efficiency);

    const Cm = calcCm({ A, M: item.M, F, m, n, eta, H, V1, deltaT });
    const Xm = calcXm(F, d, H);
    const C_bg = item.background_mg_m3 ?? 0;
    const C_total = Cm + C_bg;
    const gdk_mr = getGdkMrInMgM3(norm);
    const ratio = gdk_mr ? C_total / gdk_mr : null;
    const exceeded = gdk_mr ? C_total > gdk_mr : false;

    const profile = calcProfile(Cm, Xm, F);

    return {
      pollutant: item.pollutant,
      pollutant_name: norm.name,
      M_g_s: item.M,
      F,
      Cm_mg_m3: Number(Cm.toFixed(5)),
      Cm_ug_m3: Number((Cm * 1000).toFixed(2)),
      background_mg_m3: Number(C_bg.toFixed(5)),
      background_ug_m3: Number((C_bg * 1000).toFixed(2)),
      total_mg_m3: Number(C_total.toFixed(5)),
      total_ug_m3: Number((C_total * 1000).toFixed(2)),
      gdk_mr_mg_m3: Number(gdk_mr.toFixed(4)),
      gdk_mr_ug_m3: Number((gdk_mr * 1000).toFixed(2)),
      gdk_ratio: ratio !== null ? Number(ratio.toFixed(4)) : null,
      exceeded,
      Xm_m: Number(Xm.toFixed(2)),
      profile
    };
  });

  return {
    data: {
      source_params: {
        V1_m3_s: Number(V1.toFixed(4)),
        deltaT_c: Number(deltaT.toFixed(2)),
        f: Number(f.toFixed(5)),
        vm_m_s: Number(vm.toFixed(4)),
        vm_prime_m_s: Number(vmPrime.toFixed(4)),
        m: Number(m.toFixed(4)),
        n: Number(n.toFixed(4)),
        d: Number(d.toFixed(4)),
        eta
      },
      results
    },
    passport: {
      method: 'ОНД-86 (формули 2.1, 2.12, 2.23); Наказ МОЗ № 52; Наказ Мінекоресурсів № 286',
      inputs: {
        H_m: H,
        D_m: D,
        w0_m_s: w0,
        T_gas_c: T_gas,
        T_air_c: T_air,
        cleaning_efficiency_pct: cleaning_efficiency,
        emissions: emissions.map((e) => ({
          pollutant: e.pollutant,
          M_g_s: e.M,
          background_mg_m3: e.background_mg_m3 ?? 0
        }))
      },
      coefficients: {
        A,
        eta,
        V1_m3_s: Number(V1.toFixed(4)),
        deltaT_c: Number(deltaT.toFixed(2)),
        f: Number(f.toFixed(5)),
        vm_m_s: Number(vm.toFixed(4)),
        vm_prime_m_s: Number(vmPrime.toFixed(4)),
        m: Number(m.toFixed(4)),
        n: Number(n.toFixed(4)),
        d: Number(d.toFixed(4))
      },
      norms_version: ond86Norms.version,
      gdk_valid_from: gdkNorms.meta?.valid_from || '2020-01-14',
      norms_sources: [...(gdkNorms.meta?.sources || []), ond86Norms.source]
    }
  };
}

module.exports = {
  calcV1,
  calcDeltaT,
  calcFParam,
  calcVm,
  calcVmPrime,
  calcM,
  calcN,
  resolveSedimentationF,
  calcD,
  calcXm,
  calcCm,
  calcS1,
  calcProfile,
  getGdkMrInMgM3,
  calculateDispersion
};