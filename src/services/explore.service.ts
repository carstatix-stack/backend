import type { Prisma } from '@prisma/client';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { ExploreQuery } from '../schemas/explore.schema.js';

function maskVin(vin: string): string {
  return vin.length > 8 ? `${vin.slice(0, 4)}…${vin.slice(-4)}` : vin;
}

type ReportCardSource = {
  publicSlug: string | null;
  publishedAt: Date | null;
  vehicle: {
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string;
  };
  listing: {
    askingPrice: Prisma.Decimal | null;
    location: string | null;
  } | null;
};

export function toPublicReportCard(report: ReportCardSource) {
  return {
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
  };
}

const cardInclude = {
  vehicle: true,
  listing: true,
} as const;

export async function listExploreFeed(query: ExploreQuery) {
  const where: Prisma.ReportWhereInput = {
    status: 'PUBLISHED',
    publicSlug: { not: null },
  };

  if (query.q) {
    const term = query.q;
    where.OR = [
      { vehicle: { make: { contains: term, mode: 'insensitive' } } },
      { vehicle: { model: { contains: term, mode: 'insensitive' } } },
    ];
  }

  if (query.location) {
    where.listing = {
      location: { contains: query.location, mode: 'insensitive' },
    };
  }

  if (query.cursor) {
    where.publishedAt = { lt: new Date(query.cursor) };
  }

  const reports = await prisma.report.findMany({
    where,
    include: cardInclude,
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
  });

  const items = reports.map(toPublicReportCard);
  const nextCursor =
    reports.length === query.limit && reports[reports.length - 1]?.publishedAt
      ? reports[reports.length - 1]!.publishedAt!.toISOString()
      : null;

  const [verifiedInventory, withLocation] = await Promise.all([
    prisma.report.count({
      where: { status: 'PUBLISHED', publicSlug: { not: null } },
    }),
    query.location
      ? prisma.report.count({
          where: {
            status: 'PUBLISHED',
            publicSlug: { not: null },
            listing: {
              location: { contains: query.location, mode: 'insensitive' },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    items,
    nextCursor,
    stats: {
      verifiedInventory,
      localMatches: withLocation,
    },
  };
}

export async function listSavedReports(userId: string) {
  const saved = await prisma.savedReport.findMany({
    where: {
      userId,
      report: { status: 'PUBLISHED', publicSlug: { not: null } },
    },
    include: {
      report: { include: cardInclude },
    },
    orderBy: { createdAt: 'desc' },
  });

  return saved.map((row) => ({
    ...toPublicReportCard(row.report),
    savedAt: row.createdAt,
  }));
}

export async function saveReportBySlug(userId: string, slug: string) {
  const report = await prisma.report.findFirst({
    where: { publicSlug: slug, status: 'PUBLISHED' },
    select: { id: true, publicSlug: true },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  const existing = await prisma.savedReport.findUnique({
    where: {
      userId_reportId: { userId, reportId: report.id },
    },
  });

  if (existing) {
    return { saved: true, created: false, slug: report.publicSlug };
  }

  await prisma.savedReport.create({
    data: { userId, reportId: report.id },
  });

  return { saved: true, created: true, slug: report.publicSlug };
}

export async function unsaveReportBySlug(userId: string, slug: string) {
  const report = await prisma.report.findFirst({
    where: { publicSlug: slug, status: 'PUBLISHED' },
    select: { id: true },
  });

  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  await prisma.savedReport.deleteMany({
    where: { userId, reportId: report.id },
  });

  return { saved: false };
}

export async function isReportSaved(userId: string, slug: string) {
  const report = await prisma.report.findFirst({
    where: { publicSlug: slug, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!report) return false;

  const row = await prisma.savedReport.findUnique({
    where: {
      userId_reportId: { userId, reportId: report.id },
    },
  });
  return Boolean(row);
}
