import { z } from 'zod';

/** Normalize adapter quirks: spaces, $ prefixes, bare 4-digit codes. */
function normalizeDtcCode(raw: string): string {
  let value = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[0-9A-F]{4}$/.test(value)) {
    value = `P${value}`;
  }
  return value;
}

const dtcCodeSchema = z
  .string()
  .trim()
  .min(1)
  .transform(normalizeDtcCode)
  .refine((value) => /^[PCBU][0-9A-F]{4}$/.test(value), {
    message: 'Invalid OBD-II DTC format',
  });

export const dtcStatusSchema = z.enum(['stored', 'pending', 'permanent']);

export const explainDtcCodesSchema = z.object({
  codes: z
    .array(
      z.object({
        code: dtcCodeSchema,
        status: dtcStatusSchema.optional(),
        title: z
          .string()
          .trim()
          .max(500)
          .optional()
          .transform((value) => (value && value.length > 0 ? value.slice(0, 200) : undefined)),
      }),
    )
    .min(1)
    .max(20),
  vehicle: z
    .object({
      make: z.string().trim().max(80).optional(),
      model: z.string().trim().max(80).optional(),
      year: z.coerce.number().int().min(1980).max(2100).optional(),
    })
    .optional(),
});

export type ExplainDtcCodesInput = z.infer<typeof explainDtcCodesSchema>;
