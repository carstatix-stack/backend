import { z } from 'zod';

const dtcCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[PCBU][0-9A-F]{4}$/, 'Invalid OBD-II DTC format');

export const dtcStatusSchema = z.enum(['stored', 'pending', 'permanent']);

export const explainDtcCodesSchema = z.object({
  codes: z
    .array(
      z.object({
        code: dtcCodeSchema,
        status: dtcStatusSchema.optional(),
        title: z.string().trim().max(200).optional(),
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
