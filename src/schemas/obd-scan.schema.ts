import { z } from 'zod';

const MAX_OBD_JSON_CHARS = 100_000;

function limitedJsonRecord(label: string) {
  return z.record(z.unknown()).superRefine((value, ctx) => {
    const size = JSON.stringify(value).length;
    if (size > MAX_OBD_JSON_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} exceeds ${MAX_OBD_JSON_CHARS} characters`,
      });
    }
  });
}

export const createObdScanSchema = z.object({
  summary: limitedJsonRecord('summary'),
  source: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.enum(['STANDALONE', 'ONBOARDING'])),
  vin: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value == null) return undefined;
      const trimmed = value.trim().toUpperCase();
      return trimmed.length === 0 ? undefined : trimmed.slice(0, 17);
    }),
  reportId: z.string().min(1).max(64).optional(),
  deviceName: z.string().trim().max(120).optional(),
  rawData: limitedJsonRecord('rawData').optional(),
  scannedAt: z.string().datetime().optional(),
});

export type CreateObdScanInput = z.infer<typeof createObdScanSchema>;
