import type { MediaType } from '@prisma/client';
import { nanoid } from 'nanoid';

import { isS3Configured } from '../config/env.js';
import { requireS3Config } from '../config/s3.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { PresignMediaInput } from '../schemas/media.schema.js';
import * as reportService from './report.service.js';
import {
  assertObjectExists,
  buildPublicObjectUrl,
  createPresignedPutUrl,
  deleteObject,
} from './s3.service.js';

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

function assertS3Enabled(): void {
  if (!isS3Configured()) {
    throw new AppError(
      503,
      'Media uploads are not configured on this server',
      'S3_NOT_CONFIGURED',
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

function buildStorageKey(
  reportId: string,
  type: MediaType,
  category: string,
  ext: string,
): string {
  const folder = type === 'PHOTO' ? 'photos' : 'videos';
  return `reports/${reportId}/${folder}/${category}/${nanoid(12)}.${ext}`;
}

async function assertReportOwner(reportId: string, userId: string) {
  return reportService.getReportForOwner(reportId, userId);
}

export async function presignUpload(
  reportId: string,
  userId: string,
  input: PresignMediaInput,
) {
  assertS3Enabled();
  await assertReportOwner(reportId, userId);

  const cfg = requireS3Config();
  const maxBytes = input.type === 'PHOTO' ? cfg.maxPhotoBytes : cfg.maxVideoBytes;
  if (input.fileSize > maxBytes) {
    throw new AppError(
      400,
      `File exceeds maximum size of ${maxBytes} bytes`,
      'FILE_TOO_LARGE',
    );
  }

  const ext = resolveExtension(input.type, input.contentType);
  const storageKey = buildStorageKey(reportId, input.type, input.category, ext);
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

  const { uploadUrl, expiresIn } = await createPresignedPutUrl(
    storageKey,
    input.contentType,
  );

  return {
    assetId: asset.id,
    storageKey,
    uploadUrl,
    method: 'PUT' as const,
    headers: { 'Content-Type': input.contentType },
    expiresIn,
  };
}

export async function confirmUpload(
  reportId: string,
  userId: string,
  assetId: string,
) {
  assertS3Enabled();
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

  await assertObjectExists(asset.storageKey);
  const url = buildPublicObjectUrl(asset.storageKey);

  const updated = await prisma.mediaAsset.update({
    where: { id: assetId },
    data: { url },
  });

  await prisma.report.update({
    where: { id: reportId },
    data: { progressStep: { set: 3 } },
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
  assertS3Enabled();
  await assertReportOwner(reportId, userId);

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, reportId },
  });

  if (!asset) {
    throw new AppError(404, 'Media asset not found', 'MEDIA_NOT_FOUND');
  }

  try {
    await deleteObject(asset.storageKey);
  } catch {
    // Object may never have been uploaded; still remove DB row.
  }

  await prisma.mediaAsset.delete({ where: { id: assetId } });
  return { ok: true };
}
