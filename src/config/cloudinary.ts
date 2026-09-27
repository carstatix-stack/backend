import { v2 as cloudinary } from 'cloudinary';

import { env, isCloudinaryConfigured } from './env.js';

export type CloudinaryRuntimeConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  maxPhotoBytes: number;
  maxVideoBytes: number;
};

let configured = false;

export function requireCloudinaryConfig(): CloudinaryRuntimeConfig {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!.trim(),
    apiKey: env.CLOUDINARY_API_KEY!.trim(),
    apiSecret: env.CLOUDINARY_API_SECRET!.trim(),
    folder: (env.CLOUDINARY_FOLDER || 'carstatix').replace(/^\/+|\/+$/g, ''),
    maxPhotoBytes: env.CLOUDINARY_MAX_PHOTO_BYTES,
    maxVideoBytes: env.CLOUDINARY_MAX_VIDEO_BYTES,
  };
}

export function ensureCloudinaryConfigured(): CloudinaryRuntimeConfig {
  const cfg = requireCloudinaryConfig();
  if (!configured) {
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cfg;
}

export { cloudinary };
