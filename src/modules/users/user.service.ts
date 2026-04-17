import { type UserRole, type UserStatus } from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import { comparePassword, hashPassword } from '@/modules/auth/auth.utils';
import {
  type ChangePasswordInput,
  type GetUsersQuery,
  type IPublicUserProfile,
  type IUserProfile,
  type UpdateAvatarInput,
  type UpdateProfileInput,
  type UpdateUserStatusInput,
} from '@/modules/users/user.types';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type { Request } from 'express';

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Full profile fields (returned to the owner or admin) */
const fullProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Public profile fields (returned for any user lookup) */
const publicProfileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
} as const;

// ─── Get My Profile ───────────────────────────────────────────────────────────

export async function getMyProfile(userId: string): Promise<IUserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: fullProfileSelect,
  });

  if (!user) throw new NotFoundError('User not found');
  return user;
}

// ─── Update My Profile ────────────────────────────────────────────────────────

export async function updateMyProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<IUserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.phone !== undefined && { phone: input.phone }),
    },
    select: fullProfileSelect,
  });

  logger.info(`Profile updated: ${user.email}`);
  return updated;
}

// ─── Update Avatar ────────────────────────────────────────────────────────────

export async function updateAvatar(
  userId: string,
  input: UpdateAvatarInput,
): Promise<IUserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: input.avatarUrl },
    select: fullProfileSelect,
  });

  logger.info(`Avatar updated: ${user.email}`);
  return updated;
}

// ─── Change Password ──────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const isMatch = await comparePassword(input.currentPassword, user.password);
  if (!isMatch) throw new BadRequestError('Current password is incorrect');

  const hashed = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  // Revoke all refresh tokens (force re-login on other devices)
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  logger.info(`Password changed: ${user.email}`);
  return { message: 'Password changed successfully. Please log in again on other devices.' };
}

// ─── Get User By ID (Admin or Self) ──────────────────────────────────────────

export async function getUserById(
  requesterId: string,
  requesterRole: UserRole,
  targetId: string,
): Promise<IUserProfile | IPublicUserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select:
      requesterRole === 'ADMIN' || requesterId === targetId
        ? fullProfileSelect
        : publicProfileSelect,
  });

  if (!user) throw new NotFoundError('User not found');
  return user;
}

// ─── Get All Users (Admin Only) ───────────────────────────────────────────────

export async function getAllUsers(
  req: Request,
  query: GetUsersQuery,
): Promise<{
  users: IUserProfile[];
  meta: ReturnType<typeof buildMeta>;
}> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { role, status, search } = query;

  const where = {
    ...(role && { role }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: fullProfileSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { users, meta: buildMeta(total, page, limit) };
}

// ─── Update User Status (Admin Only) ─────────────────────────────────────────

export async function updateUserStatus(
  adminId: string,
  targetId: string,
  input: UpdateUserStatusInput,
): Promise<IUserProfile> {
  if (adminId === targetId) {
    throw new ForbiddenError('You cannot change your own status');
  }

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new NotFoundError('User not found');

  // Prevent changing another admin's status
  if (user.role === 'ADMIN') {
    throw new ForbiddenError('Cannot change the status of another admin');
  }

  if (user.status === input.status) {
    throw new ConflictError(`User is already ${input.status.toLowerCase()}`);
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { status: input.status as UserStatus },
    select: fullProfileSelect,
  });

  // If suspending, revoke all refresh tokens
  if (input.status === 'SUSPENDED') {
    await prisma.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  logger.info(`User status updated to ${input.status}: ${user.email} (by admin ${adminId})`);
  return updated;
}
