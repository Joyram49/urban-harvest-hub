import { type Response } from 'express';

import { type IApiMeta, type IApiResponse } from '@/interfaces/response.interface';

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(
  res: Response,
  options: {
    statusCode?: number;
    message: string;
    data?: T;
    meta?: IApiMeta;
  },
): Response {
  const { statusCode = 200, message, data, meta } = options;

  const response: IApiResponse<T> = {
    success: true,
    statusCode,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  };

  return res.status(statusCode).json(response);
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  options: {
    statusCode?: number;
    message: string;
    errors?: { field?: string; message: string }[];
  },
): Response {
  const { statusCode = 500, message, errors } = options;

  const response: IApiResponse = {
    success: false,
    statusCode,
    message,
    ...(errors?.length && { errors }),
  };

  return res.status(statusCode).json(response);
}

/**
 * Build pagination meta object
 */
export function buildMeta(total: number, page: number, limit: number): IApiMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, { data, message, statusCode: 201 });
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
