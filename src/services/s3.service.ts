import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { requireS3Config } from '../config/s3.js';
import { AppError } from '../lib/errors.js';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  const cfg = requireS3Config();
  client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  return client;
}

export function buildPublicObjectUrl(storageKey: string): string {
  const { publicBaseUrl } = requireS3Config();
  return `${publicBaseUrl}/${storageKey}`;
}

export async function createPresignedPutUrl(
  storageKey: string,
  contentType: string,
): Promise<{ uploadUrl: string; expiresIn: number }> {
  const cfg = requireS3Config();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: cfg.presignExpiresSeconds,
  });

  return { uploadUrl, expiresIn: cfg.presignExpiresSeconds };
}

export async function assertObjectExists(storageKey: string): Promise<void> {
  const cfg = requireS3Config();

  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: cfg.bucket,
        Key: storageKey,
      }),
    );
  } catch {
    throw new AppError(
      400,
      'Uploaded file not found in storage. Complete the PUT upload before confirming.',
      'UPLOAD_NOT_FOUND',
    );
  }
}

export async function deleteObject(storageKey: string): Promise<void> {
  const cfg = requireS3Config();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: storageKey,
    }),
  );
}
