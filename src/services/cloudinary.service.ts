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

export function createCloudinarySignedUpload(params: {
  type: MediaType;
  publicId: string;
}): CloudinarySignedUpload {
  const cfg = ensureCloudinaryConfigured();
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = resourceTypeFor(params.type);

  // Only params that are sent with the upload (except file/api_key/resource_type) are signed.
  const toSign: Record<string, string | number> = {
    public_id: params.publicId,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(toSign, cfg.apiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/upload`,
    method: 'POST',
    expiresIn: 55 * 60,
    fields: {
      api_key: cfg.apiKey,
      timestamp: String(timestamp),
      signature,
      public_id: params.publicId,
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
      buildCloudinaryPublicUrl(type, publicId);
    return url;
  } catch {
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
