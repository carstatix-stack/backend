import type { FastifyInstance } from 'fastify';

import * as exploreService from '../services/explore.service.js';

export async function savedRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request, reply) => {
    const items = await exploreService.listSavedReports(request.userId!);
    return reply.send({ items });
  });

  app.post('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const result = await exploreService.saveReportBySlug(
      request.userId!,
      slug,
    );
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.delete('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const result = await exploreService.unsaveReportBySlug(
      request.userId!,
      slug,
    );
    return reply.send(result);
  });
}
