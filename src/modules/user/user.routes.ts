import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdmin } from '@/modules/auth/auth.middleware';
import * as userController from '@/modules/user/user.controller';
import {
  changePasswordSchema,
  getUsersQuerySchema,
  updateAvatarSchema,
  updateProfileSchema,
  updateUserStatusSchema,
} from '@/modules/user/user.types';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ─── Self (any authenticated user) ───────────────────────────────────────────
router.get('/me', userController.getMyProfile);
router.patch('/me', validate(updateProfileSchema), userController.updateMyProfile);
router.patch('/me/avatar', validate(updateAvatarSchema), userController.updateAvatar);
router.patch('/me/change-password', validate(changePasswordSchema), userController.changePassword);

// ─── Admin-only ───────────────────────────────────────────────────────────────
router.get('/', isAdmin, validate(getUsersQuerySchema), userController.getAllUsers);
router.patch(
  '/:id/status',
  isAdmin,
  validate(updateUserStatusSchema),
  userController.updateUserStatus,
);

// ─── Self or Admin ────────────────────────────────────────────────────────────
router.get('/:id', userController.getUserById);

export default router;
