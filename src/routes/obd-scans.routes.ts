import type { FastifyInstance } from 'fastify';

import { createObdScanSchema } from '../schemas/obd-scan.schema.js';
import * as obdScanService from '../services/obd-scan.service.js';

export async function obdScansRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.post('/', async (request, reply) => {
    const body = createObdScanSchema.parse(request.body);
    const scan = await obdScanService.createObdScan(request.userId!, body);
    return reply.status(201).send({ scan });
  });

  app.get('/', async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? Number(query.limit) : 50;
    const scans = await obdScanService.listObdScans(
      request.userId!,
      Number.isFinite(limit) ? limit : 50,
    );
    return reply.send({ scans });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await obdScanService.getObdScanForOwner(id, request.userId!);
    return reply.send({ scan });
  });
}
