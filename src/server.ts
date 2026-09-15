import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { redis } from './config/redis';

const server = app.listen(env.port, () => {
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down gracefully`);
  server.close(() => {
    Promise.allSettled([prisma.$disconnect(), redis.quit()]).finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
  server.close(() => process.exit(1));
});
