import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { swaggerSpec } from '@/config/swagger';
import { errorHandler } from '@/middlewares/errorHandler.middleware';
import { notFoundHandler } from '@/middlewares/notFound.middleware';
import { apiLimiter } from '@/middlewares/rateLimiter.middleware';
// ─── Module Routes (imported as they are built) ───────────────────────────────
import authRoutes from '@/modules/auth/auth.routes';
import bookingRoutes from '@/modules/bookings/booking.routes';
import cartRoutes from '@/modules/cart/cart.routes';
import certificationRoutes from '@/modules/certifications/certification.routes';
import farmRoutes from '@/modules/farms/farm.routes';
import forumRoutes from '@/modules/forum/forum.routes';
import gardenSpaceRoutes from '@/modules/gardenSpaces/gardenSpace.routes';
import notificationRoutes from '@/modules/notifications/notification.routes';
import orderRoutes from '@/modules/orders/order.routes';
import plantTrackingRoutes from '@/modules/plantTracking/plantTracking.routes';
import productRoutes from '@/modules/products/product.routes';
import userRoutes from '@/modules/users/user.routes';
import vendorRoutes from '@/modules/vendors/vendor.routes';
// ... more routes will be added per module

export function createApp(): Application {
  const app = express();

  // ─── Security Middlewares ─────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  app.use(`/api/${env.API_VERSION}`, apiLimiter);

  // ─── Parsing Middlewares ──────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ─── HTTP Request Logging ─────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(
      morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
        stream: { write: (msg) => logger.http(msg.trim()) },
      }),
    );
  }

  // ─── API Documentation ────────────────────────────────────────────────────
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Urban Harvest Hub API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  // ─── Health Check ─────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Urban Harvest Hub API is running',
      data: {
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        version: env.API_VERSION,
      },
    });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────
  // Routes will be mounted here as modules are built:
  app.use(`/api/${env.API_VERSION}/auth`, authRoutes);
  app.use(`/api/${env.API_VERSION}/users`, userRoutes);
  app.use(`/api/${env.API_VERSION}/vendors`, vendorRoutes);
  app.use(`/api/${env.API_VERSION}/notifications`, notificationRoutes);
  app.use(`/api/${env.API_VERSION}/farms`, farmRoutes);
  app.use(`/api/${env.API_VERSION}/garden-spaces`, gardenSpaceRoutes);
  app.use(`/api/${env.API_VERSION}/plant-tracking`, plantTrackingRoutes);
  app.use(`/api/${env.API_VERSION}/products`, productRoutes);
  app.use(`/api/${env.API_VERSION}/cart`, cartRoutes);
  app.use(`/api/${env.API_VERSION}/orders`, orderRoutes);
  app.use(`/api/${env.API_VERSION}/bookings`, bookingRoutes);
  app.use(`/api/${env.API_VERSION}/forum`, forumRoutes);
  app.use(`/api/${env.API_VERSION}/certificate`, certificationRoutes);

  // ─── 404 Handler ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global Error Handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
