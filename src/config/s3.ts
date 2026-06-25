import { env, isS3Configured } from './env.js';

export type S3RuntimeConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  maxPhotoBytes: number;
  maxVideoBytes: number;
  presignExpiresSeconds: number;
};

export function requireS3Config(): S3RuntimeConfig {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured');
  }

  return {
    region: env.S3_REGION!,
    bucket: env.S3_BUCKET!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    publicBaseUrl: env.S3_PUBLIC_BASE_URL!.replace(/\/$/, ''),
    maxPhotoBytes: env.S3_MAX_PHOTO_BYTES,
    maxVideoBytes: env.S3_MAX_VIDEO_BYTES,
    presignExpiresSeconds: env.S3_PRESIGN_EXPIRES_SECONDS,
  };
}
