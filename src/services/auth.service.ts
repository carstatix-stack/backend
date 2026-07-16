import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';

import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';

const SALT_ROUNDS = 12;

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

async function signSession(app: FastifyInstance, user: AuthUser) {
  const token = await app.jwt.sign({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function registerUser(app: FastifyInstance, input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existing) {
    throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return signSession(app, user);
}

export async function loginUser(app: FastifyInstance, input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return signSession(app, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}
