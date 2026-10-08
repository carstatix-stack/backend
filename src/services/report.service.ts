import { createHash } from 'node:crypto';

import type { InspectionRating, Prisma } from '@prisma/client';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { createPublicSlug, buildPublicReportUrl } from '../lib/slug.js';
import type {
  CosmeticInput,
  InspectionBatchInput,
  ListingInput,
  ObdReadingInput,
  StartReportInput,
} from '../schemas/report.schema.js';
import { generateQrPngDataUrl } from './qr.service.js';

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/** Owner check for read paths (draft + published OK). */
export async function assertReportOwner(reportId: string, userId: string) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, userId },
    include: { vehicle: true },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  return report;
}

/** Owner check for write paths — published/archived reports are locked. */
export async function assertMutableReportOwner(reportId: string, userId: string) {
  const report = await assertReportOwner(reportId, userId);

  if (report.status === 'ARCHIVED') {
    throw new AppError(400, 'Report is archived', 'REPORT_ARCHIVED');
  }

  if (report.status === 'PUBLISHED') {
    throw new AppError(
      400,
      'Published reports cannot be modified',
      'REPORT_PUBLISHED',
    );
  }

  return report;
}

export async function startReport(
  userId: string,
  input: StartReportInput,
  meta?: { ip?: string; userAgent?: string },
) {
  const vin = input.vin.toUpperCase();

  // One active report per user+VIN (draft or published). Archived can be replaced.
  const existing = await prisma.report.findFirst({
    where: {
      userId,
      status: { in: ['DRAFT', 'PUBLISHED'] },
      vehicle: { vin },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      progressStep: true,
      publicSlug: true,
    },
  });

  if (existing) {
    const statusLabel =
      existing.status === 'PUBLISHED' ? 'published' : 'already in progress';
    throw new AppError(
      409,
      `A report for this VIN is ${statusLabel}. Open it from Garage instead of creating a new one.`,
      'VIN_REPORT_EXISTS',
    );
  }

  const vehicle = await prisma.vehicle.upsert({
    where: {
      userId_vin: { userId, vin },
    },
    create: {
      userId,
      vin,
      make: input.make,
      model: input.model,
      year: input.year,
    },
    update: {
      make: input.make ?? undefined,
      model: input.model ?? undefined,
      year: input.year ?? undefined,
    },
  });

  const consentAgentParts = [
    meta?.userAgent,
    `consent=${input.consentVersion}`,
  ].filter(Boolean);

  const report = await prisma.report.create({
    data: {
      userId,
      vehicleId: vehicle.id,
      progressStep: 1,
      consent: {
        create: {
          userId,
          vin,
          agreedAt: input.consentAgreedAt
            ? new Date(input.consentAgreedAt)
            : new Date(),
          ipHash: meta?.ip ? hashIp(meta.ip) : undefined,
          userAgent: consentAgentParts.join(' | ') || undefined,
        },
      },
    },
    include: {
      vehicle: true,
      consent: true,
    },
  });

  return report;
}

export async function listUserReports(userId: string) {
  return prisma.report.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      vehicle: true,
      obdReading: { select: { scannedAt: true } },
      listing: { select: { inspector: true, location: true } },
    },
  });
}

export async function deleteDraftReport(reportId: string, userId: string) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, userId },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  if (report.status !== 'DRAFT') {
    throw new AppError(400, 'Only draft reports can be deleted', 'REPORT_NOT_DRAFT');
  }

  try {
    // Prefer sequential ops over interactive transactions — more reliable
    // behind Railway/PgBouncer connection pooling.
    await prisma.$transaction([
      prisma.mediaAsset.deleteMany({ where: { reportId } }),
      prisma.inspectionItem.deleteMany({ where: { reportId } }),
      prisma.obdReading.deleteMany({ where: { reportId } }),
      prisma.cosmeticRating.deleteMany({ where: { reportId } }),
      prisma.listingDetail.deleteMany({ where: { reportId } }),
      prisma.consentLog.deleteMany({ where: { reportId } }),
      prisma.savedReport.deleteMany({ where: { reportId } }),
      prisma.obdScan.updateMany({
        where: { reportId },
        data: { reportId: null },
      }),
      prisma.report.delete({ where: { id: reportId } }),
    ]);
  } catch (error) {
    // Keep internal DB details in logs only — never send to clients.
    console.error('Draft delete failed', { reportId, userId, error });
    throw new AppError(
      409,
      'Could not delete this draft. Please try again.',
      'DRAFT_DELETE_FAILED',
    );
  }

  return { ok: true };
}

export async function getReportForOwner(reportId: string, userId: string) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, userId },
    include: {
      vehicle: true,
      consent: true,
      obdReading: true,
      cosmetic: true,
      inspections: true,
      listing: true,
      media: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  return report;
}

export async function updateProgressStep(
  reportId: string,
  userId: string,
  progressStep: number,
) {
  await assertMutableReportOwner(reportId, userId);
  await prisma.report.update({
    where: { id: reportId },
    data: { progressStep: Math.min(7, Math.max(1, progressStep)) },
  });
}

export async function saveObdReading(
  reportId: string,
  userId: string,
  input: ObdReadingInput,
) {
  await assertMutableReportOwner(reportId, userId);

  const obd = await prisma.obdReading.upsert({
    where: { reportId },
    create: {
      reportId,
      summary: input.summary as Prisma.InputJsonValue,
      rawData: input.rawData as Prisma.InputJsonValue | undefined,
    },
    update: {
      summary: input.summary as Prisma.InputJsonValue,
      rawData: input.rawData as Prisma.InputJsonValue | undefined,
      scannedAt: new Date(),
    },
  });

  await prisma.report.update({
    where: { id: reportId },
    data: { progressStep: { set: 2 } },
  });

  return obd;
}

export async function saveCosmetic(
  reportId: string,
  userId: string,
  input: CosmeticInput,
) {
  await assertMutableReportOwner(reportId, userId);

  const cosmetic = await prisma.cosmeticRating.upsert({
    where: { reportId },
    create: { reportId, ...input },
    update: input,
  });

  await prisma.report.update({
    where: { id: reportId },
    data: { progressStep: { set: 4 } },
  });

  return cosmetic;
}

export async function saveInspections(
  reportId: string,
  userId: string,
  input: InspectionBatchInput,
) {
  await assertMutableReportOwner(reportId, userId);

  await prisma.$transaction([
    prisma.inspectionItem.deleteMany({ where: { reportId } }),
    prisma.inspectionItem.createMany({
      data: input.items.map((item) => ({
        reportId,
        systemName: item.systemName,
        rating: (item.rating as InspectionRating | undefined) ?? null,
        observations: item.observations,
      })),
    }),
    prisma.report.update({
      where: { id: reportId },
      // 3 = 12-point inspection complete (indicators + required photos).
      data: { progressStep: 3 },
    }),
  ]);

  return prisma.inspectionItem.findMany({ where: { reportId } });
}

export async function saveListing(
  reportId: string,
  userId: string,
  input: ListingInput,
) {
  await assertMutableReportOwner(reportId, userId);

  const listing = await prisma.listingDetail.upsert({
    where: { reportId },
    create: {
      reportId,
      inspector: input.inspector,
      location: input.location,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      externalUrls: input.externalUrls as Prisma.InputJsonValue | undefined,
    },
    update: {
      inspector: input.inspector,
      location: input.location,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      externalUrls: input.externalUrls as Prisma.InputJsonValue | undefined,
    },
  });

  await prisma.report.update({
    where: { id: reportId },
    data: { progressStep: 6 },
  });

  return listing;
}

export async function publishReport(reportId: string, userId: string) {
  const report = await assertReportOwner(reportId, userId);

  if (report.status === 'ARCHIVED') {
    throw new AppError(400, 'Report is archived', 'REPORT_ARCHIVED');
  }

  if (report.status === 'PUBLISHED') {
    throw new AppError(400, 'Report is already published', 'ALREADY_PUBLISHED');
  }

  const publicSlug = createPublicSlug();
  const publicUrl = buildPublicReportUrl(publicSlug, env.PUBLIC_BASE_URL);
  const qrDataUrl = await generateQrPngDataUrl(publicSlug, env.PUBLIC_BASE_URL);

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: 'PUBLISHED',
      publicSlug,
      qrImageUrl: qrDataUrl,
      publishedAt: new Date(),
      progressStep: 7,
    },
    include: { vehicle: true },
  });

  return {
    report: updated,
    publicUrl,
    qrDataUrl,
  };
}

function fullVin(vin: string): string {
  return vin.trim().toUpperCase();
}

export async function searchPublishedReportsByVin(vin: string) {
  const normalized = vin.trim().toUpperCase();

  const reports = await prisma.report.findMany({
    where: {
      status: 'PUBLISHED',
      publicSlug: { not: null },
      vehicle: { vin: normalized },
    },
    include: {
      vehicle: true,
      listing: true,
    },
    orderBy: { publishedAt: 'desc' },
  });

  return reports.map((report) => ({
    slug: report.publicSlug!,
    publicUrl: `${env.PUBLIC_BASE_URL}/r/${report.publicSlug}`,
    publishedAt: report.publishedAt,
    vehicle: {
      make: report.vehicle.make,
      model: report.vehicle.model,
      year: report.vehicle.year,
      vin: fullVin(report.vehicle.vin),
    },
    listing: report.listing
      ? {
          inspector: report.listing.inspector,
          location: report.listing.location,
        }
      : null,
  }));
}

export async function getPublicReport(slug: string) {
  const report = await prisma.report.findFirst({
    where: {
      publicSlug: slug,
      status: 'PUBLISHED',
    },
    include: {
      vehicle: true,
      obdReading: true,
      cosmetic: true,
      inspections: true,
      listing: true,
      media: {
        where: { url: { not: null } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  const vin = fullVin(report.vehicle.vin);

  return {
    slug: report.publicSlug,
    publishedAt: report.publishedAt,
    vehicle: {
      make: report.vehicle.make,
      model: report.vehicle.model,
      year: report.vehicle.year,
      vin,
    },
    obd: report.obdReading?.summary ?? null,
    cosmetic: report.cosmetic,
    inspections: report.inspections,
    listing: report.listing
      ? {
          inspector: report.listing.inspector,
          location: report.listing.location,
        }
      : null,
    media: report.media.map((m) => ({
      type: m.type,
      category: m.category,
      url: m.url,
    })),
  };
}
