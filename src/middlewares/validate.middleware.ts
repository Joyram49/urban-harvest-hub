import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '@/interfaces/response.interface';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates request data against a Zod schema.
 * @param schema  Zod object schema
 * @param part    Which part of req to validate ('body' | 'query' | 'params')
 */
export const validate =
  (schema: AnyZodObject, part: RequestPart = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      req[part] = schema.parse(req[part]);
      next();
    } catch (err) {
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
      next(err);
    }
  };
