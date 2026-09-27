import type { MediaType } from '@prisma/client';
import { nanoid } from 'nanoid';

import { requireCloudinaryConfig } from '../config/cloudinary.js';
import { isCloudinaryConfigured } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type {
  ConfirmMediaInput,
  PresignMediaInput,
} from '../schemas/media.schema.js';
import {
  assertCloudinaryAssetExists,
  buildCloudinaryPublicUrl,
  createCloudinarySignedUpload,
  deleteCloudinaryAsset,
} from './cloudinary.service.js';
import * as reportService from './report.service.js';

const PHOTO_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

function assertCloudinaryEnabled(): void {
  if (!isCloudinaryConfigured()) {
    throw new AppError(
      503,
      'Media uploads are not configured on this server (set Cloudinary env vars)',
      'MEDIA_NOT_CONFIGURED',
    );
  }
}

function resolveExtension(type: MediaType, contentType: string): string {
  const map = type === 'PHOTO' ? PHOTO_CONTENT_TYPES : VIDEO_CONTENT_TYPES;
  const ext = map[contentType.toLowerCase()];
  if (!ext) {
    throw new AppError(
      400,
      `Unsupported content type: ${contentType}`,
      'UNSUPPORTED_CONTENT_TYPE',
    );
  }
  return ext;
}

function buildPublicId(
  reportId: string,
  type: MediaType,
  category: string,
): string {
  const { folder } = requireCloudinaryConfig();
  const kind = type === 'PHOTO' ? 'photos' : 'videos';
  return `${folder}/reports/${reportId}/${kind}/${category}/${nanoid(12)}`;
}

async function assertReportOwner(reportId: string, userId: string) {
  return reportService.getReportForOwner(reportId, userId);
}

export async function presignUpload(
  reportId: string,
  userId: string,
  input: PresignMediaInput,
) {
  assertCloudinaryEnabled();
  await assertReportOwner(reportId, userId);

  const cfg = requireCloudinaryConfig();
  const maxBytes =
    input.type === 'PHOTO' ? cfg.maxPhotoBytes : cfg.maxVideoBytes;
  if (input.fileSize > maxBytes) {
    throw new AppError(
      400,
      `File exceeds maximum size of ${maxBytes} bytes`,
      'FILE_TOO_LARGE',
    );
  }

  resolveExtension(input.type, input.contentType);
  const storageKey = buildPublicId(reportId, input.type, input.category);
  const capturedAt = new Date(input.capturedAt);

  const asset = await prisma.mediaAsset.create({
    data: {
      reportId,
      type: input.type,
      category: input.category,
      storageKey,
      capturedAt,
      gpsLat: input.gpsLat,
      gpsLng: input.gpsLng,
    },
  });

  const signed = createCloudinarySignedUpload({
    type: input.type,
    publicId: storageKey,
  });

  return {
    provider: 'cloudinary' as const,
    assetId: asset.id,
    storageKey,
    uploadUrl: signed.uploadUrl,
    method: signed.method,
    headers: {} as Record<string, string>,
    fields: signed.fields,
    expiresIn: signed.expiresIn,
  };
}

export async function confirmUpload(
  reportId: string,
  userId: string,
  assetId: string,
  input: ConfirmMediaInput = {},
) {
  assertCloudinaryEnabled();
  await assertReportOwner(reportId, userId);

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, reportId },
  });

  if (!asset) {
    throw new AppError(404, 'Media asset not found', 'MEDIA_NOT_FOUND');
  }

  if (asset.url) {
    return {
      asset: {
        id: asset.id,
        type: asset.type,
        category: asset.category,
        url: asset.url,
        storageKey: asset.storageKey,
        capturedAt: asset.capturedAt,
      },
    };
  }

  let url: string;
  if (input.secureUrl && input.secureUrl.trim()) {
    url = input.secureUrl.trim();
  } else {
    try {
      url = await assertCloudinaryAssetExists(asset.type, asset.storageKey);
    } catch {
      url = buildCloudinaryPublicUrl(asset.type, asset.storageKey);
    }
  }

  const updated = await prisma.mediaAsset.update({
    where: { id: assetId },
    data: { url },
  });

  return {
    asset: {
      id: updated.id,
      type: updated.type,
      category: updated.category,
      url: updated.url,
      storageKey: updated.storageKey,
      capturedAt: updated.capturedAt,
    },
  };
}

export async function listReportMedia(reportId: string, userId: string) {
  await assertReportOwner(reportId, userId);

  const media = await prisma.mediaAsset.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
  });

  return media.map((m) => ({
    id: m.id,
    type: m.type,
    category: m.category,
    url: m.url,
    storageKey: m.storageKey,
    capturedAt: m.capturedAt,
    pending: m.url == null,
  }));
}

export async function deleteMediaAsset(
  reportId: string,
  userId: string,
  assetId: string,
) {
  assertCloudinaryEnabled();
  await assertReportOwner(reportId, userId);

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, reportId },
  });

  if (!asset) {
    throw new AppError(404, 'Media asset not found', 'MEDIA_NOT_FOUND');
  }

  try {
    await deleteCloudinaryAsset(asset.type, asset.storageKey);
  } catch {
    // Asset may never have been uploaded; still remove DB row.
  }

  await prisma.mediaAsset.delete({ where: { id: assetId } });
  return { ok: true };
}
