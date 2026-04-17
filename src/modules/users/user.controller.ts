import { MESSAGES } from '@/constants/messages.constants';
import { UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as userService from '@/modules/users/user.service';
import type {
  ChangePasswordInput,
  GetUsersQuery,
  UpdateAvatarInput,
  UpdateProfileInput,
  UpdateUserStatusInput,
} from '@/modules/users/user.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

// ─── GET /users/me ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *       401:
 *         description: Unauthorized
 */
export const getMyProfile = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const userId = req.user.id;
  const user = await userService.getMyProfile(userId);
  sendSuccess(res, { message: MESSAGES.USER.PROFILE_FETCHED, data: user });
});

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, minLength: 2, maxLength: 50 }
 *               lastName:  { type: string, minLength: 2, maxLength: 50 }
 *               phone:     { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: No fields provided / validation error
 */
export const updateMyProfile = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await userService.updateMyProfile(req.user.id, req.body as UpdateProfileInput);
  sendSuccess(res, { message: MESSAGES.USER.PROFILE_UPDATED, data: user });
});

// ─── PATCH /users/me/avatar ───────────────────────────────────────────────────

/**
 * @swagger
 * /users/me/avatar:
 *   patch:
 *     summary: Update current user's avatar URL
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [avatarUrl]
 *             properties:
 *               avatarUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 */
export const updateAvatar = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await userService.updateAvatar(req.user.id, req.body as UpdateAvatarInput);
  sendSuccess(res, { message: MESSAGES.USER.AVATAR_UPDATED, data: user });
});

// ─── PATCH /users/me/change-password ─────────────────────────────────────────

/**
 * @swagger
 * /users/me/change-password:
 *   patch:
 *     summary: Change current user's password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password incorrect / passwords do not match
 */
export const changePassword = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await userService.changePassword(req.user.id, req.body as ChangePasswordInput);
  sendSuccess(res, { message: result.message });
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (full profile for admin/self, public for others)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User profile fetched
 *       404:
 *         description: User not found
 */
export const getUserById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const userId = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = await userService.getUserById(req.user.id, req.user.role, userId);
  sendSuccess(res, { message: MESSAGES.USER.PROFILE_FETCHED, data: user });
});

// ─── GET /users (Admin) ───────────────────────────────────────────────────────

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [ADMIN, VENDOR, CUSTOMER] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, UNVERIFIED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Users list fetched
 *       403:
 *         description: Forbidden
 */
export const getAllUsers = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { users, meta } = await userService.getAllUsers(req, req.query as GetUsersQuery);
  sendSuccess(res, { message: 'Users fetched successfully', data: users, meta });
});

// ─── PATCH /users/:id/status (Admin) ─────────────────────────────────────────

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     summary: Update a user's status (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *     responses:
 *       200:
 *         description: User status updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
export const updateUserStatus = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const userId = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = await userService.updateUserStatus(
    req.user.id,
    userId,
    req.body as UpdateUserStatusInput,
  );
  sendSuccess(res, { message: 'User status updated successfully', data: user });
});
