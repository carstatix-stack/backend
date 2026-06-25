import { customAlphabet } from 'nanoid';

/** URL-safe public slug for report pages (not the raw VIN). */
const generateSlug = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  12,
);

export function createPublicSlug(): string {
  return generateSlug();
}

export function buildPublicReportUrl(slug: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/r/${slug}`;
}
