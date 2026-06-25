import type { FastifyInstance } from 'fastify';

import {
  cosmeticSchema,
  inspectionBatchSchema,
  listingSchema,
  obdReadingSchema,
  progressStepSchema,
  startReportSchema,
} from '../schemas/report.schema.js';
import { presignMediaSchema } from '../schemas/media.schema.js';
import * as mediaService from '../services/media.service.js';
import * as reportService from '../services/report.service.js';

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request, reply) => {
    const reports = await reportService.listUserReports(request.userId!);
    return reply.send({ reports });
  });

  app.post('/', async (request, reply) => {
    const body = startReportSchema.parse(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];
    const report = await reportService.startReport(request.userId!, body, {
      ip,
      userAgent,
    });
    return reply.status(201).send({ report });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await reportService.getReportForOwner(id, request.userId!);
    return reply.send({ report });
  });

  app.patch('/:id/progress', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = progressStepSchema.parse(request.body);
    await reportService.updateProgressStep(id, request.userId!, body.progressStep);
    return reply.send({ ok: true, progressStep: body.progressStep });
  });

  app.get('/:id/media', async (request, reply) => {
    const { id } = request.params as { id: string };
    const media = await mediaService.listReportMedia(id, request.userId!);
    return reply.send({ media });
  });

  app.post('/:id/media/presign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = presignMediaSchema.parse(request.body);
    const presign = await mediaService.presignUpload(id, request.userId!, body);
    return reply.status(201).send(presign);
  });

  app.post('/:id/media/:assetId/confirm', async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string };
    const result = await mediaService.confirmUpload(id, request.userId!, assetId);
    return reply.send(result);
  });

  app.delete('/:id/media/:assetId', async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string };
    const result = await mediaService.deleteMediaAsset(id, request.userId!, assetId);
    return reply.send(result);
  });

  app.patch('/:id/obd', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = obdReadingSchema.parse(request.body);
    const obd = await reportService.saveObdReading(id, request.userId!, body);
    return reply.send({ obd });
  });

  app.patch('/:id/cosmetic', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = cosmeticSchema.parse(request.body);
    const cosmetic = await reportService.saveCosmetic(id, request.userId!, body);
    return reply.send({ cosmetic });
  });

  app.patch('/:id/inspection', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = inspectionBatchSchema.parse(request.body);
    const items = await reportService.saveInspections(id, request.userId!, body);
    return reply.send({ items });
  });

  app.patch('/:id/listing', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = listingSchema.parse(request.body);
    const listing = await reportService.saveListing(id, request.userId!, body);
    return reply.send({ listing });
  });

  app.post('/:id/publish', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await reportService.publishReport(id, request.userId!);
    return reply.send(result);
  });
}
