import { config } from 'dotenv';
import { z } from 'zod';

config();

function resolvePublicBaseUrl(): string {
  const raw = (process.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  const railwayDomain = (process.env.RAILWAY_PUBLIC_DOMAIN ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const isLocal =
    !raw ||
    raw.includes('localhost') ||
    raw.includes('127.0.0.1') ||
    raw.includes('0.0.0.0');

  // In production, never ship QR/report links that point at localhost.
  if (process.env.NODE_ENV === 'production' && isLocal) {
    if (railwayDomain) return `https://${railwayDomain}`;
    return 'https://api.carstatix.com';
  }

  if (raw) return raw;
  if (railwayDomain) return `https://${railwayDomain}`;
  return 'http://localhost:3000';
}

process.env.PUBLIC_BASE_URL = resolvePublicBaseUrl();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // Shorter access-token lifetime reduces damage from a stolen JWT.
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Cloudinary — required for inspection photo uploads.
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().min(1).default('carstatix'),
  CLOUDINARY_MAX_PHOTO_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 1024 * 1024),
  CLOUDINARY_MAX_VIDEO_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(50 * 1024 * 1024),

  // OpenAI — optional; required for AI DTC explanations
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim(),
  );
}

/** @deprecated Use [isCloudinaryConfigured]. */
export function isMediaConfigured(): boolean {
  return isCloudinaryConfigured();
}

export function getCorsOrigins(): string[] | boolean {
  if (env.NODE_ENV === 'development') {
    return true;
  }

  const origins = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Never allow wildcard CORS in production.
  if (origins.length === 0 || origins.includes('*')) {
    console.warn(
      'CORS_ORIGINS missing or "*" in production — falling back to PUBLIC_BASE_URL origin only.',
    );
    try {
      return [new URL(env.PUBLIC_BASE_URL).origin];
    } catch {
      return ['https://api.carstatix.com'];
    }
  }

  return origins;
}
