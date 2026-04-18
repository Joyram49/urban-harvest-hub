import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdmin, isAdminOrVendor, isVendor } from '@/modules/auth/auth.middleware';

import * as certificationController from './certification.controller';
import {
  certificationParamsSchema,
  listCertificationsQuerySchema,
  reviewCertificationSchema,
  uploadCertificationSchema,
} from './certification.types';

const router = Router();

// ─── Vendor Routes ────────────────────────────────────────────────────────────

// POST /certifications — upload a new certification
router.post(
  '/',
  authenticate,
  isVendor,
  validate(uploadCertificationSchema),
  certificationController.uploadCertification,
);

// GET /certifications/my — list my certifications
router.get('/my', authenticate, isVendor, certificationController.getMyCertifications);

// GET /certifications/:id — get a single certification (vendor sees own, admin sees any)
router.get(
  '/:id',
  authenticate,
  isAdminOrVendor,
  validate(certificationParamsSchema),
  certificationController.getCertificationById,
);

// DELETE /certifications/:id — delete a pending certification (vendor only)
router.delete(
  '/:id',
  authenticate,
  isVendor,
  validate(certificationParamsSchema),
  certificationController.deleteCertification,
);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /certifications/admin — list all certifications with filters
router.get(
  '/admin',
  authenticate,
  isAdmin,
  validate(listCertificationsQuerySchema),
  certificationController.adminListCertifications,
);

// PATCH /certifications/admin/:id/review — approve or reject
router.patch(
  '/admin/:id/review',
  authenticate,
  isAdmin,
  validate(reviewCertificationSchema),
  certificationController.reviewCertification,
);

export default router;
