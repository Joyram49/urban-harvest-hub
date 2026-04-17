import http from 'http';
import { createApp } from './app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { connectDatabase, disconnectDatabase } from '@/config/prisma';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { initializeSocket } from '@/config/socket';

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
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`\n${signal} received – shutting down gracefully...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          await disconnectRedis();
          logger.info('All connections closed. Goodbye 👋');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
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

bootstrap();
