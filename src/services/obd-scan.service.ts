import type { Prisma } from '@prisma/client';

import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { CreateObdScanInput } from '../schemas/obd-scan.schema.js';

function serializeScan(scan: {
  id: string;
  userId: string;
  reportId: string | null;
  vin: string | null;
  source: string;
  summary: Prisma.JsonValue;
  rawData: Prisma.JsonValue | null;
  deviceName: string | null;
  scannedAt: Date;
  createdAt: Date;
}) {
  return {
    id: scan.id,
    userId: scan.userId,
    reportId: scan.reportId,
    vin: scan.vin,
    source: scan.source,
    summary: scan.summary,
    rawData: scan.rawData,
    deviceName: scan.deviceName,
    scannedAt: scan.scannedAt.toISOString(),
    createdAt: scan.createdAt.toISOString(),
  };
}

export async function createObdScan(userId: string, input: CreateObdScanInput) {
  if (input.reportId) {
    const report = await prisma.report.findFirst({
      where: { id: input.reportId, userId },
      select: { id: true },
    });
    if (!report) {
      throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
    }
  }

  const scan = await prisma.obdScan.create({
    data: {
      userId,
      reportId: input.reportId ?? null,
      vin: input.vin ?? null,
      source: input.source,
      summary: input.summary as Prisma.InputJsonValue,
      rawData: (input.rawData as Prisma.InputJsonValue | undefined) ?? undefined,
      deviceName: input.deviceName ?? null,
      scannedAt: input.scannedAt ? new Date(input.scannedAt) : new Date(),
    },
  });

  return serializeScan(scan);
}

export async function listObdScans(userId: string, limit = 50) {
  const take = Math.min(Math.max(limit, 1), 100);
  const scans = await prisma.obdScan.findMany({
    where: { userId },
    orderBy: { scannedAt: 'desc' },
    take,
  });
  return scans.map(serializeScan);
}

export async function getObdScanForOwner(id: string, userId: string) {
  const scan = await prisma.obdScan.findFirst({
    where: { id, userId },
  });
  if (!scan) {
    throw new AppError(404, 'OBD scan not found', 'OBD_SCAN_NOT_FOUND');
  }
  return serializeScan(scan);
}
