import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[server] received ${signal}, shutting down gracefully`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[server] unhandled rejection:', reason);
  server.close(() => process.exit(1));
});
