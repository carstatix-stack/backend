import type { MediaType } from '@prisma/client';

import {
  cloudinary,
  ensureCloudinaryConfigured,
  requireCloudinaryConfig,
} from '../config/cloudinary.js';
import { AppError } from '../lib/errors.js';

export type CloudinarySignedUpload = {
  uploadUrl: string;
  method: 'POST';
  expiresIn: number;
  fields: Record<string, string>;
};

function resourceTypeFor(type: MediaType): 'image' | 'video' {
  return type === 'VIDEO' ? 'video' : 'image';
}

const PHOTO_FORMATS = 'jpg,png,webp,heic,heif';
const VIDEO_FORMATS = 'mp4,mov';

export function createCloudinarySignedUpload(params: {
  type: MediaType;
  publicId: string;
  maxBytes: number;
}): CloudinarySignedUpload {
  const cfg = ensureCloudinaryConfigured();
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = resourceTypeFor(params.type);
  const allowedFormats = params.type === 'VIDEO' ? VIDEO_FORMATS : PHOTO_FORMATS;

  // Sign every constraint the client must send (except file/api_key/resource_type).
  const toSign: Record<string, string | number> = {
    public_id: params.publicId,
    timestamp,
    max_file_size: params.maxBytes,
    allowed_formats: allowedFormats,
  };

  const signature = cloudinary.utils.api_sign_request(toSign, cfg.apiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/upload`,
    method: 'POST',
    // Short-lived upload permission (10 minutes).
    expiresIn: 10 * 60,
    fields: {
      api_key: cfg.apiKey,
      timestamp: String(timestamp),
      signature,
      public_id: params.publicId,
      max_file_size: String(params.maxBytes),
      allowed_formats: allowedFormats,
    },
  };
}

export function buildCloudinaryPublicUrl(
  type: MediaType,
  publicId: string,
): string {
  const { cloudName } = requireCloudinaryConfig();
  const resourceType = resourceTypeFor(type);
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}`;
}

/** True when URL is https Cloudinary for our cloud and contains the storage key. */
export function isAllowedCloudinaryUrl(
  url: string,
  cloudName: string,
  storageKey: string,
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'res.cloudinary.com') return false;
    const path = parsed.pathname;
    if (!path.startsWith(`/${cloudName}/`)) return false;
    return path.includes(`/${storageKey}`) || path.includes(`/${encodeURIComponent(storageKey)}`);
  } catch {
    return false;
  }
}

export async function assertCloudinaryAssetExists(
  type: MediaType,
  publicId: string,
): Promise<string> {
  ensureCloudinaryConfigured();
  const resourceType = resourceTypeFor(type);

  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    const url =
      (typeof result.secure_url === 'string' && result.secure_url) ||
      (typeof result.url === 'string' && result.url) ||
      null;
    if (!url) {
      throw new AppError(
        400,
        'Uploaded file not found in Cloudinary. Complete the upload before confirming.',
        'UPLOAD_NOT_FOUND',
      );
    }
    return url;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      'Uploaded file not found in Cloudinary. Complete the upload before confirming.',
      'UPLOAD_NOT_FOUND',
    );
  }
}

export async function deleteCloudinaryAsset(
  type: MediaType,
  publicId: string,
): Promise<void> {
  ensureCloudinaryConfigured();
  const resourceType = resourceTypeFor(type);
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch {
    // Asset may never have been uploaded; ignore.
  }
}
