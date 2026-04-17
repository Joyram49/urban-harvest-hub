import { UserRole } from '@prisma/client';
import { type NextFunction, type Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import { verifyAccessToken } from '@/modules/auth/auth.utils';

// ─── Authenticate ─────────────────────────────────────────────────────────────

/**
 * Verifies the Bearer access token.
 * Attaches `req.user = { id, email, role }` on success.
 */
export function authenticate(req: IAuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') {
      next(new UnauthorizedError('Access token has expired'));
    } else if ((err as Error).name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid access token'));
    } else {
      next(err);
    }
  }
}

// ─── Authorize (RBAC) ─────────────────────────────────────────────────────────

/**
 * Restricts access to users with one of the specified roles.
 * Must be used after `authenticate`.
 *
 * @example
 * router.get('/admin/users', authenticate, authorize('ADMIN'), controller)
 * router.post('/farms', authenticate, authorize('VENDOR', 'ADMIN'), controller)
 */
export function authorize(...roles: UserRole[]) {
  return (req: IAuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied. Required role(s): ${roles.join(', ')}`));
    }
    next();
  };
}

// ─── Convenience role guards ──────────────────────────────────────────────────

export const isAdmin = authorize(UserRole.ADMIN);
export const isVendor = authorize(UserRole.VENDOR);
export const isCustomer = authorize(UserRole.CUSTOMER);
export const isAdminOrVendor = authorize(UserRole.ADMIN, UserRole.VENDOR);
