import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../lib/errors.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await request.jwtVerify<JwtPayload>();
    request.userId = payload.sub;
  } catch {
    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
}

export function registerAuthHooks(app: FastifyInstance): void {
  app.decorate('authenticate', authenticate);
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}
