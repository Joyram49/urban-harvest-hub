import { UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';

import { PASSWORD } from '@/constants';

// ─── Reusable sub-schemas ─────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
  .max(PASSWORD.MAX_LENGTH, `Password must be at most ${PASSWORD.MAX_LENGTH} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .trim()
        .min(2, 'First name must be at least 2 characters')
        .max(50, 'First name must be at most 50 characters')
        .optional(),
      lastName: z
        .string()
        .trim()
        .min(2, 'Last name must be at least 2 characters')
        .max(50, 'Last name must be at most 50 characters')
        .optional(),
      phone: z.string().trim().optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const updateAvatarSchema = z.object({
  body: z.object({
    avatarUrl: z.string().trim().url('avatarUrl must be a valid URL'),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().trim().min(1, 'Current password is required'),
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED], {
      message: 'Status must be ACTIVE or SUSPENDED',
    }),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'User ID is required'),
  }),
});

export const getUsersQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    role: z.enum([UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER]).optional(),
    status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.UNVERIFIED]).optional(),
    search: z.string().trim().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>['query'];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface IUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPublicUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: Date;
}
