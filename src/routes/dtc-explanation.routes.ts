import type { FastifyInstance } from 'fastify';

import { explainDtcCodesSchema } from '../schemas/dtc-explanation.schema.js';
import * as dtcExplanationService from '../services/dtc-explanation.service.js';

export async function dtcExplanationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.post('/dtc-explain', async (request, reply) => {
    const body = explainDtcCodesSchema.parse(request.body);
    const result = await dtcExplanationService.explainDtcCodes(body);
    return reply.send(result);
  });
}
