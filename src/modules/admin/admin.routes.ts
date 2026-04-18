import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import * as adminController from '@/modules/admin/admin.controller';
import {
  idParamSchema,
  listCertificationsSchema,
  listUsersSchema,
  listVendorsSchema,
  reviewCertificationSchema,
  updateUserStatusSchema,
  updateVendorStatusSchema,
} from '@/modules/admin/admin.types';
import { authenticate, isAdmin } from '@/modules/auth/auth.middleware';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate, isAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', validate(listUsersSchema), adminController.listUsers);
router.get('/users/:id', validate(idParamSchema), adminController.getUserById);
router.patch(
  '/users/:id/status',
  validate(updateUserStatusSchema),
  adminController.updateUserStatus,
);

// ─── Vendors ──────────────────────────────────────────────────────────────────
router.get('/vendors', validate(listVendorsSchema), adminController.listVendors);
router.get('/vendors/:id', validate(idParamSchema), adminController.getVendorById);
router.patch(
  '/vendors/:id/status',
  validate(updateVendorStatusSchema),
  adminController.updateVendorStatus,
);

// ─── Certifications ───────────────────────────────────────────────────────────
router.get(
  '/certifications',
  validate(listCertificationsSchema),
  adminController.listCertifications,
);
router.get('/certifications/:id', validate(idParamSchema), adminController.getCertificationById);
router.patch(
  '/certifications/:id/review',
  validate(reviewCertificationSchema),
  adminController.reviewCertification,
);

// ─── Forum Moderation ─────────────────────────────────────────────────────────
router.get('/forum/reports', adminController.listForumReports);
router.patch(
  '/forum/reports/:id/resolve',
  validate(idParamSchema),
  adminController.resolveForumReport,
);
router.delete('/forum/posts/:id', validate(idParamSchema), adminController.deleteForumPost);
router.patch('/forum/posts/:id/pin', validate(idParamSchema), adminController.pinForumPost);
router.patch('/forum/posts/:id/lock', validate(idParamSchema), adminController.lockForumPost);

export default router;
