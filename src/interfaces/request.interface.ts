import { Request } from 'express';

export type UserRole = 'ADMIN' | 'VENDOR' | 'CUSTOMER';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
