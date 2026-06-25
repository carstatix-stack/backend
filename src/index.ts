import { env } from './config/env.js';
import { buildApp } from './app.js';
import { prisma } from './lib/prisma.js';

async function main() {
  const app = await buildApp();

  try {
    await prisma.$connect();
    app.log.info('Connected to PostgreSQL');
  } catch (err) {
    app.log.error(err, 'Failed to connect to PostgreSQL');
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
