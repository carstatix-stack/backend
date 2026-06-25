import type { FastifyInstance } from 'fastify';

import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import * as authService from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await authService.registerUser(body);
    return reply.status(201).send({ user });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(app, body);
    return reply.send(result);
  });

  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await authService.getUserById(request.userId!);
      return reply.send({ user });
    },
  );
}
