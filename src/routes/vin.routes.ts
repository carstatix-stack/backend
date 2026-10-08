import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as vinService from '../services/vin.service.js';

const vinParamSchema = z.object({
  vin: z.string().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i),
});

export async function vinRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  /** Decode VIN via NHTSA vPIC (authenticated — matches app UX). */
  app.get(
    '/:vin',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { vin } = vinParamSchema.parse(request.params);
      const vehicle = await vinService.decodeVin(vin);
      return reply.send({ vehicle });
    },
  );
}
