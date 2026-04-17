import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { ApiError } from '@/interfaces/response.interface';
import { logger } from '@/config/logger';
import { env } from '@/config/env';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // ─── Zod Validation Error ────────────────────────────────────────
  if (err instanceof ZodError) {
    const errors: ApiError[] = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(422).json({
      success: false,
      statusCode: 422,
      message: 'Validation failed',
      errors,
    });
    return;
  }

  // ─── Prisma Known Request Errors ─────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        statusCode: 409,
        message: `A record with this ${field} already exists`,
        errors: [{ field, message: 'Must be unique' }],
      });
      return;
    }

    if (err.code === 'P2025') {
      // Record not found
      res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Record not found',
      });
      return;
    }

    if (err.code === 'P2003') {
      // Foreign key constraint violation
      res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Related record does not exist',
      });
      return;
    }

    logger.error(`Prisma error [${err.code}]: ${err.message}`);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Database error occurred',
    });
    return;
  }

  // ─── Operational App Errors ───────────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      ...(err.errors?.length && { errors: err.errors }),
    });
    return;
  }

  // ─── Unknown / Programming Errors ────────────────────────────────
  const unknownErr = err as Error;
  logger.error('Unhandled error:', {
    message: unknownErr?.message,
    stack: unknownErr?.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    statusCode: 500,
    message:
      env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : (unknownErr?.message ?? 'Internal server error'),
    ...(env.NODE_ENV === 'development' && { stack: unknownErr?.stack }),
  });
}
