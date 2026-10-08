import { z } from 'zod';

import { INSPECTION_LABELS, INSPECTION_POINT_COUNT } from '../lib/inspection-points.js';

const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;

export const startReportSchema = z.object({
  vin: z.string().length(17).regex(vinRegex, 'Invalid VIN format'),
  consent: z.literal(true),
  /** UI consent copy version (audit trail). */
  consentVersion: z.string().min(1).max(64).default('vin-link-v1'),
  /** ISO timestamp when the user tapped Agree (optional). */
  consentAgreedAt: z.string().datetime({ offset: true }).optional(),
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

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

export const obdReadingSchema = z.object({
  summary: limitedJsonRecord('summary'),
  rawData: limitedJsonRecord('rawData').optional(),
});

/** @deprecated Cosmetic ratings are no longer used by the 12-point inspection flow. */
export const cosmeticSchema = z.object({
  exteriorRating: z.number().int().min(1).max(5),
  interiorRating: z.number().int().min(1).max(5),
  glassRating: z.number().int().min(1).max(5),
  tireNotes: z.string().max(2000).optional(),
});

export const inspectionItemSchema = z.object({
  systemName: z
    .string()
    .min(1)
    .max(80)
    .refine((value) => INSPECTION_LABELS.has(value), {
      message: 'Unknown inspection point',
    }),
  /// Green→GOOD, Blue→FAIR, Red→ATTENTION (nullable for skipped optional points).
  rating: z.enum(['GOOD', 'FAIR', 'ATTENTION', 'NOT_TESTED']).optional(),
  /// Notes are optional for every inspection point.
  observations: z.string().trim().max(2000).optional().default(''),
});

export const inspectionBatchSchema = z
  .object({
    items: z.array(inspectionItemSchema).min(INSPECTION_POINT_COUNT).max(INSPECTION_POINT_COUNT),
  })
  .superRefine((body, ctx) => {
    const names = body.items.map((item) => item.systemName);
    const unique = new Set(names);
    if (unique.size !== names.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate inspection points are not allowed',
        path: ['items'],
      });
    }
    for (const label of INSPECTION_LABELS) {
      if (!unique.has(label)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing inspection point: ${label}`,
          path: ['items'],
        });
      }
    }
  });

export const progressStepSchema = z.object({
  progressStep: z.number().int().min(1).max(7),
});

function normalizeListingUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export const listingSchema = z
  .object({
    // .nullish() = optional + nullable (JSON null from clients must not fail).
    inspector: z
      .string()
      .trim()
      .max(120)
      .nullish()
      .transform((value) => (value == null || value === '' ? undefined : value)),
    location: z
      .string()
      .max(200)
      .nullish()
      .transform((value) => (value == null || value.trim() === '' ? undefined : value.trim())),
    phone: z
      .string()
      .max(30)
      .nullish()
      .transform((value) => (value == null || value.trim() === '' ? undefined : value.trim())),
    email: z
      .string()
      .max(254)
      .nullish()
      .transform((value) => (value == null || value.trim() === '' ? undefined : value.trim())),
    // Optional marketplace links. Empty / omitted is fine.
    // Bare domains (facebook.com/...) get https:// added.
    externalUrls: z
      .array(z.string().max(2048))
      .max(10)
      .nullish()
      .transform((urls) => {
        if (!urls) return undefined;
        const normalized = urls
          .map(normalizeListingUrl)
          .filter((url): url is string => Boolean(url));
        return normalized.length > 0 ? normalized : undefined;
      }),
  })
  .superRefine((data, ctx) => {
    const phone = (data.phone ?? '').trim();
    const email = data.email ?? '';
    const phoneDigits = phone.replace(/\D/g, '');
    const hasPhone = phoneDigits.length >= 7;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (phone && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone must contain at least 7 digits',
        path: ['phone'],
      });
    }

    if (email && !hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valid email address is required',
        path: ['email'],
      });
    }

    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a phone number or an email address',
        path: ['phone'],
      });
    }
  });

export type StartReportInput = z.infer<typeof startReportSchema>;
export type ObdReadingInput = z.infer<typeof obdReadingSchema>;
export type CosmeticInput = z.infer<typeof cosmeticSchema>;
export type InspectionBatchInput = z.infer<typeof inspectionBatchSchema>;
export type ProgressStepInput = z.infer<typeof progressStepSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
