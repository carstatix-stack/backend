import { z } from 'zod';

export const createObdScanSchema = z.object({
  summary: z.record(z.unknown()),
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
  rawData: z.record(z.unknown()).optional(),
  scannedAt: z.string().datetime().optional(),
});

export type CreateObdScanInput = z.infer<typeof createObdScanSchema>;
