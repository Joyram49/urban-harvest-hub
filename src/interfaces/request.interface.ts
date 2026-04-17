import { type Request } from 'express';

export type UserRole = 'ADMIN' | 'VENDOR' | 'CUSTOMER';

export interface IAuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface IAuthenticatedRequest extends Request {
  user?: IAuthenticatedUser;
}
