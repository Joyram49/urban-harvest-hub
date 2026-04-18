import http from 'http';

import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { connectDatabase, disconnectDatabase } from '@/config/prisma';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { initializeSocket } from '@/config/socket';
import { lifecycle } from '@/core/lifecycle';

import { createApp } from './app';

async function bootstrap(): Promise<void> {
  try {
    // ─── Connect to services ───────────────────────────────────────────────
    await connectDatabase();
    await connectRedis();

    // ─── Create Express app & HTTP server ─────────────────────────────────
    const app = createApp();
    const httpServer = http.createServer(app);

    // ─── Initialize Socket.IO ──────────────────────────────────────────────
    initializeSocket(httpServer);

    // ─── Start listening ───────────────────────────────────────────────────
    httpServer.listen(env.PORT, () => {
      logger.info(`Urban Harvest Hub API running in ${env.NODE_ENV} mode`);
      logger.info(`Server listening on http://localhost:${env.PORT}`);
      logger.info(`API Docs available at http://localhost:${env.PORT}/api-docs`);
      logger.info(`Health check at http://localhost:${env.PORT}/health`);
    });

    // ─── Graceful Shutdown ─────────────────────────────────────────────────
    lifecycle.register({
      name: 'database',
      fn: disconnectDatabase,
    });

    lifecycle.register({
      name: 'redis',
      fn: disconnectRedis,
    });

    lifecycle.register({
      name: 'http',
      fn: () =>
        new Promise((resolve) => {
          httpServer.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        }),
    });

    lifecycle.initSignals();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ─── Handle unhandled rejections & exceptions ────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

void bootstrap();
