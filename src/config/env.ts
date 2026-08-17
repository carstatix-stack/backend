import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().url().optional(),
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:*'),

  // Object storage (AWS S3, Cloudflare R2, MinIO). All five vars required to enable uploads.
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false'),
  S3_MAX_PHOTO_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  S3_MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const publicBaseUrl =
  parsed.data.PUBLIC_BASE_URL?.replace(/\/$/, '') ??
  (parsed.data.RAILWAY_PUBLIC_DOMAIN
    ? `https://${parsed.data.RAILWAY_PUBLIC_DOMAIN}`
    : null);

if (!publicBaseUrl) {
  console.error(
    'Set PUBLIC_BASE_URL, or deploy on Railway so RAILWAY_PUBLIC_DOMAIN is available.',
  );
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PUBLIC_BASE_URL: publicBaseUrl,
};

export function isS3Configured(): boolean {
  return Boolean(
    env.S3_REGION &&
      env.S3_BUCKET &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY &&
      env.S3_PUBLIC_BASE_URL,
  );
}

export function getCorsOrigins(): string[] | boolean {
  if (env.NODE_ENV === 'development') {
    return true;
  }
  const raw = env.CORS_ORIGINS.trim();
  if (raw === '*') {
    return true;
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}
