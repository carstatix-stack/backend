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

async function assertReportOwner(reportId: string, userId: string) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, userId },
    include: { vehicle: true },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  if (report.status === 'ARCHIVED') {
    throw new AppError(400, 'Report is archived', 'REPORT_ARCHIVED');
  }

  return report;
}

export async function startReport(
  userId: string,
  input: StartReportInput,
  meta?: { ip?: string; userAgent?: string },
) {
  const vin = input.vin.toUpperCase();

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

  const report = await prisma.report.create({
    data: {
      userId,
      vehicleId: vehicle.id,
      progressStep: 1,
      consent: {
        create: {
          userId,
          vin,
          ipHash: meta?.ip ? hashIp(meta.ip) : undefined,
          userAgent: meta?.userAgent,
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
      listing: { select: { askingPrice: true } },
    },
  });
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
  await assertReportOwner(reportId, userId);
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
  await assertReportOwner(reportId, userId);

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
  await assertReportOwner(reportId, userId);

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
  await assertReportOwner(reportId, userId);

  await prisma.$transaction([
    prisma.inspectionItem.deleteMany({ where: { reportId } }),
    prisma.inspectionItem.createMany({
      data: input.items.map((item) => ({
        reportId,
        systemName: item.systemName,
        rating: item.rating as InspectionRating,
        observations: item.observations,
      })),
    }),
    prisma.report.update({
      where: { id: reportId },
      data: { progressStep: 5 },
    }),
  ]);

  return prisma.inspectionItem.findMany({ where: { reportId } });
}

export async function saveListing(
  reportId: string,
  userId: string,
  input: ListingInput,
) {
  await assertReportOwner(reportId, userId);

  const listing = await prisma.listingDetail.upsert({
    where: { reportId },
    create: {
      reportId,
      askingPrice: input.askingPrice,
      location: input.location,
      phone: input.phone,
      email: input.email,
      externalUrls: input.externalUrls as Prisma.InputJsonValue | undefined,
    },
    update: {
      askingPrice: input.askingPrice,
      location: input.location,
      phone: input.phone,
      email: input.email,
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

function maskVin(vin: string): string {
  return vin.length > 8 ? `${vin.slice(0, 4)}…${vin.slice(-4)}` : vin;
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
      vinMasked: maskVin(report.vehicle.vin),
    },
    listing: report.listing
      ? {
          askingPrice: report.listing.askingPrice,
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

  const maskedVin = maskVin(report.vehicle.vin);

  return {
    slug: report.publicSlug,
    publishedAt: report.publishedAt,
    vehicle: {
      make: report.vehicle.make,
      model: report.vehicle.model,
      year: report.vehicle.year,
      vinMasked: maskedVin,
    },
    obd: report.obdReading?.summary ?? null,
    cosmetic: report.cosmetic,
    inspections: report.inspections,
    listing: report.listing
      ? {
          askingPrice: report.listing.askingPrice,
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
