import type { FastifyInstance } from 'fastify';

import { explainDtcCodesSchema } from '../schemas/dtc-explanation.schema.js';
import * as dtcExplanationService from '../services/dtc-explanation.service.js';

export async function dtcExplanationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.post(
    '/dtc-explain',
    {
      config: {
        // Per authenticated user (falls back to IP before auth context is odd).
        rateLimit: {
          max: 20,
          timeWindow: '1 hour',
          keyGenerator: (request) => request.userId ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const body = explainDtcCodesSchema.parse(request.body);
      const result = await dtcExplanationService.explainDtcCodes(body);
      return reply.send(result);
    },
  );

  /** Audit trail when a user clears DTCs from the standalone OBD hub. */
  app.post(
    '/clear-codes-audit',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 hour',
          keyGenerator: (request) => request.userId ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        vin?: string;
        source?: string;
        deviceName?: string;
      };
      request.log.info(
        {
          event: 'obd_clear_codes',
          userId: request.userId,
          vin: typeof body.vin === 'string' ? body.vin.slice(0, 17) : undefined,
          source: typeof body.source === 'string' ? body.source.slice(0, 40) : undefined,
          deviceName:
            typeof body.deviceName === 'string'
              ? body.deviceName.slice(0, 80)
              : undefined,
        },
        'OBD clear-codes performed',
      );
      return reply.send({ ok: true });
    },
  );
}
