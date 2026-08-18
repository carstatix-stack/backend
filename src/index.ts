import { env } from './config/env.js';
import { buildApp } from './app.js';
import { prisma } from './lib/prisma.js';

async function main() {
  const app = await buildApp();

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Bind first so Railway healthchecks can succeed even if Postgres is slow.
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(
    { host: env.HOST, port: env.PORT, address: app.server.address() },
    'Server listening',
  );

  try {
    await prisma.$connect();
    app.log.info('Connected to PostgreSQL');
  } catch (err) {
    app.log.error(err, 'Failed to connect to PostgreSQL');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
