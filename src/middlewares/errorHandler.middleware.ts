import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { AppError } from '@/errors/AppError';
import { sendError } from '@/utils/response.util';

import type { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  logger.error({
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  // ── Operational API Errors (our custom errors) ─────────────────────────
  if (err instanceof AppError) {
    sendError(res, { message: err.message, statusCode: err.statusCode, errors: err.errors });
    return;
  }

  // ── JWT Errors ─────────────────────────────────────────────────────────
  if (err instanceof jwt.TokenExpiredError) {
    sendError(res, { message: 'Token has expired', statusCode: 401 });
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    sendError(res, { message: 'Invalid token', statusCode: 401 });
    return;
  }

  // ── Prisma Errors ──────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        sendError(res, {
          message: 'A record with this information already exists',
          statusCode: 409,
        });
        return;
      case 'P2025':
        // Record not found
        sendError(res, { message: 'Record not found', statusCode: 404 });
        return;
      case 'P2003':
        // Foreign key constraint
        sendError(res, { message: 'Related record not found', statusCode: 400 });
        return;
      default:
        sendError(res, { message: 'Database operation failed', statusCode: 500 });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, { message: 'Invalid data provided', statusCode: 400 });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    sendError(res, { message: 'Database connection failed', statusCode: 503 });
    return;
  }

  // ── SyntaxError (malformed JSON body) ─────────────────────────────────
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    sendError(res, { message: 'Invalid JSON in request body', statusCode: 400 });
    return;
  }

  // ── Unknown errors ─────────────────────────────────────────────────────
  let message = 'An unexpected error occurred';
  if (env.NODE_ENV === 'production') {
    message = 'Something went wrong. Please try again later.';
  } else if (err instanceof Error) {
    message = err.message;
  }

  sendError(res, { message, statusCode: 500 });
}

// ── 404 handler ────────────────────────────────────────────────────────────
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, { message: `Route ${req.method} ${req.originalUrl} not found`, statusCode: 404 });
}
