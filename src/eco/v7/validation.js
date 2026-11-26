const { z } = require('zod');
const gdkNorms = require('../norms/gdk.json');

const supportedPollutants = Object.keys(gdkNorms.substances);

const emissionItemSchema = z.object({
  pollutant: z
    .string()
    .refine((val) => supportedPollutants.includes(val), {
      message: `Непідтримувана речовина. Доступні: ${supportedPollutants.join(', ')}`
    }),
  M: z
    .number()
    .positive('Потужність викиду M (г/с) має бути більшою за 0'),
  background_mg_m3: z
    .number()
    .min(0, "Фонова концентрація Cф не може бути від'ємною")
    .optional()
    .default(0),
  F: z
    .number()
    .min(1, 'Коефіцієнт осідання F має бути від 1 до 3')
    .max(3, 'Коефіцієнт осідання F має бути від 1 до 3')
    .optional()
});

const dispersionInputSchema = z
  .object({
    H: z
      .number()
      .positive('Висота джерела H (м) має бути більшою за 0'),
    D: z
      .number()
      .positive('Діаметр гирла D (м) має бути більшим за 0'),
    w0: z
      .number()
      .positive('Швидкість виходу газів w0 (м/с) має бути більшою за 0'),
    T_gas: z.number(),
    T_air: z
      .number()
      .min(-60, 'Температура повітря поза допустимим діапазоном')
      .max(60, 'Температура повітря поза допустимим діапазоном')
      .optional()
      .default(25.6),
    A: z
      .number()
      .positive('Коефіцієнт стратифікації A має бути додатним')
      .optional()
      .default(180),
    eta: z
      .number()
      .min(1, 'Коефіцієнт рельєфу η має бути >= 1')
      .optional()
      .default(1),
    cleaning_efficiency: z
      .number()
      .min(0, 'Ступінь очищення має бути в межах 0–100%')
      .max(100, 'Ступінь очищення має бути в межах 0–100%')
      .optional()
      .default(90),
    emissions: z
      .array(emissionItemSchema)
      .min(1, 'Необхідно передати хоча б одну речовину у масиві emissions')
  })
  .refine((data) => data.T_gas > data.T_air, {
    message: 'Для нагрітих викидів температура газів T_gas має перевищувати температуру повітря T_air (ΔT > 0)',
    path: ['T_gas']
  });

function validateDispersionInput(payload) {
  const result = dispersionInputSchema.safeParse(payload);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message
      }))
    };
  }
  return { ok: true, data: result.data };
}

module.exports = {
  dispersionInputSchema,
  validateDispersionInput
};