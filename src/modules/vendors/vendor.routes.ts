import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdmin, isVendor } from '@/modules/auth/auth.middleware';
import * as vendorController from '@/modules/vendors/vendor.controller';
import {
  createVendorSchema,
  getVendorsQuerySchema,
  updateVendorCoverSchema,
  updateVendorLogoSchema,
  updateVendorSchema,
  updateVendorStatusSchema,
} from '@/modules/vendors/vendor.types';

const router = Router();

// All vendor routes require authentication
router.use(authenticate);

// ─── Public (any authenticated user) ─────────────────────────────────────────
router.get('/', validate(getVendorsQuerySchema), vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);

// ─── Vendor-only (own profile management) ────────────────────────────────────
router.post('/', isVendor, validate(createVendorSchema), vendorController.createVendor);
router.get('/me', isVendor, vendorController.getMyVendorProfile);
router.patch('/me', isVendor, validate(updateVendorSchema), vendorController.updateMyVendorProfile);
router.patch(
  '/me/logo',
  isVendor,
  validate(updateVendorLogoSchema),
  vendorController.updateVendorLogo,
);
router.patch(
  '/me/cover',
  isVendor,
  validate(updateVendorCoverSchema),
  vendorController.updateVendorCover,
);

// ─── Admin-only ───────────────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  isAdmin,
  validate(updateVendorStatusSchema),
  vendorController.updateVendorStatus,
);

export default router;
