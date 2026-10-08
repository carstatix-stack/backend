import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await request.jwtVerify<JwtPayload>();
    request.userId = payload.sub;
    request.userRole = payload.role;
  } catch {
    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
}

/**
 * Future admin routes should use this — reloads role from DB so a stale JWT
 * role claim cannot elevate privileges after a demotion.
 */
export function requireRole(...roles: Array<'SELLER' | 'ADMIN'>) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.userId) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { role: true },
    });

    if (!user || !roles.includes(user.role)) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    }

    request.userRole = user.role;
  };
}

export function registerAuthHooks(app: FastifyInstance): void {
  app.decorate('authenticate', authenticate);
  app.decorate('requireRole', requireRole);
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
    requireRole: typeof requireRole;
  }
}
