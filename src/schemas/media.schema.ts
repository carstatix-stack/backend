import { z } from 'zod';

const categorySlug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/, 'Category must be a lowercase slug');

const captureTimestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => {
    const captured = new Date(value).getTime();
    const now = Date.now();
    const maxSkewMs = 10 * 60 * 1000;
    return Math.abs(now - captured) <= maxSkewMs;
  }, 'Capture time must be within 10 minutes of server time');

export const presignMediaSchema = z.object({
  type: z.enum(['PHOTO', 'VIDEO']),
  category: categorySlug,
  contentType: z.string().min(3).max(128),
  fileSize: z.number().int().positive(),
  capturedAt: captureTimestamp,
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
});

export type PresignMediaInput = z.infer<typeof presignMediaSchema>;
