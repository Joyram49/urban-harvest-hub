import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isVendor } from '@/modules/auth/auth.middleware';
import * as plantController from '@/modules/plantTracking/plantTracking.controller';
import {
  addPlantUpdateSchema,
  createPlantTrackingSchema,
  plantTrackingListQuerySchema,
  updatePlantTrackingSchema,
} from '@/modules/plantTracking/plantTracking.types';

const router = Router();

// All plant tracking routes require authentication
router.use(authenticate);

// ─── Vendor-only routes ───────────────────────────────────────────────────────

router.post(
  '/',
  isVendor,
  validate(createPlantTrackingSchema),
  plantController.createPlantTracking,
);

router.patch(
  '/:id',
  isVendor,
  validate(updatePlantTrackingSchema),
  plantController.updatePlantTracking,
);

router.post(
  '/:id/updates',
  isVendor,
  validate(addPlantUpdateSchema),
  plantController.addPlantUpdate,
);

// ─── Shared routes (Customer, Vendor, Admin) ──────────────────────────────────

router.get('/', validate(plantTrackingListQuerySchema), plantController.getPlantTrackings);
router.get('/:id', plantController.getPlantTrackingById);

export default router;
