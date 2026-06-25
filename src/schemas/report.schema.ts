import { z } from 'zod';

const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;

export const startReportSchema = z.object({
  vin: z.string().length(17).regex(vinRegex, 'Invalid VIN format'),
  consent: z.literal(true),
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

export const obdReadingSchema = z.object({
  summary: z.record(z.unknown()),
  rawData: z.record(z.unknown()).optional(),
});

export const cosmeticSchema = z.object({
  exteriorRating: z.number().int().min(1).max(5),
  interiorRating: z.number().int().min(1).max(5),
  glassRating: z.number().int().min(1).max(5),
  tireNotes: z.string().max(2000).optional(),
});

export const inspectionItemSchema = z.object({
  systemName: z.string().min(1).max(80),
  rating: z.enum(['GOOD', 'FAIR', 'ATTENTION', 'NOT_TESTED']),
  observations: z.string().max(2000).optional(),
});

export const inspectionBatchSchema = z.object({
  items: z.array(inspectionItemSchema).min(1).max(20),
});

export const progressStepSchema = z.object({
  progressStep: z.number().int().min(1).max(7),
});

export const listingSchema = z.object({
  askingPrice: z.number().positive().optional(),
  location: z.string().max(200).optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .max(30)
    .refine((value) => value.replace(/\D/g, '').length >= 7, {
      message: 'Phone must contain at least 7 digits',
    }),
  email: z.string().email('Valid email address is required'),
  externalUrls: z.array(z.string().url()).max(10).optional(),
});

export type StartReportInput = z.infer<typeof startReportSchema>;
export type ObdReadingInput = z.infer<typeof obdReadingSchema>;
export type CosmeticInput = z.infer<typeof cosmeticSchema>;
export type InspectionBatchInput = z.infer<typeof inspectionBatchSchema>;
export type ProgressStepInput = z.infer<typeof progressStepSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
