import { Request } from 'express';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Extract and validate pagination params from query string.
 * Defaults: page=1, limit=10. Max limit: 100.
 */
export function getPaginationOptions(req: Request): PaginationOptions {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
