import { logger } from '@/config/logger';
import type { IApiError } from '@/interfaces/response.interface';
import { sendError } from '@/utils/response.util';

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';

/**
 * Middleware factory that validates request against a Zod schema.
 * Schema should have shape: { body?, query?, params?, cookies? }
 */
export const validate =
  (schema: ZodTypeAny): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const payload: Record<string, unknown> = {
      body: req.body,
      query: req.query,
      params: req.params,
      cookies: req.cookies,
    };
    logger.info(req.body);
    const result = schema.safeParse(payload);

    if (!result.success) {
      const errors: IApiError[] = formatZodErrors(result.error);
      sendError(res, { message: 'Validation failed', statusCode: 400, errors });
      return;
    }

    // Attach parsed/coerced values back to request
    const parsed = result.data as { body?: Record<string, unknown> };
    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }

    next();
  };

function formatZodErrors(error: ZodError): IApiError[] {
  return error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}
