import type { FastifyInstance } from 'fastify';

import { exploreQuerySchema } from '../schemas/explore.schema.js';
import * as exploreService from '../services/explore.service.js';

export async function exploreRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request, reply) => {
    const query = exploreQuerySchema.parse(request.query ?? {});
    const feed = await exploreService.listExploreFeed(query);
    return reply.send(feed);
  });
}
