import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as vinService from '../services/vin.service.js';

const vinParamSchema = z.object({
  vin: z.string().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i),
});

export async function vinRoutes(app: FastifyInstance): Promise<void> {
  /** Decode VIN via NHTSA vPIC (free, no API key). */
  app.get('/:vin', async (request, reply) => {
    const { vin } = vinParamSchema.parse(request.params);
    const vehicle = await vinService.decodeVin(vin);
    return reply.send({ vehicle });
  });
}
