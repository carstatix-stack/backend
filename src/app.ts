import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { env, getCorsOrigins, isS3Configured } from './config/env.js';
import { isAppError } from './lib/errors.js';
import { registerAuthHooks } from './plugins/auth.plugin.js';
import { authRoutes } from './routes/auth.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { vinRoutes } from './routes/vin.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: getCorsOrigins() });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  registerAuthHooks(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.flatten(),
      });
    }

    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'carstatix-api',
    timestamp: new Date().toISOString(),
    mediaUploads: isS3Configured(),
  }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(vinRoutes, { prefix: '/api/vin' });
  await app.register(reportsRoutes, { prefix: '/api/reports' });
  await app.register(publicRoutes);

  return app;
}
