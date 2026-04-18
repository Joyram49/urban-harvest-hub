import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdminOrVendor } from '@/modules/auth/auth.middleware';

import * as gardenSpaceController from './gardenSpace.controller';
import {
  createGardenSpaceSchema,
  deleteGardenSpaceSchema,
  getGardenSpaceSchema,
  listGardenSpacesQuerySchema,
  updateGardenSpaceSchema,
} from './gardenSpace.types';

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

router.get('/', validate(listGardenSpacesQuerySchema), gardenSpaceController.listGardenSpaces);
router.get('/farm/:farmId', gardenSpaceController.getSpacesByFarm);
router.get('/:id', validate(getGardenSpaceSchema), gardenSpaceController.getGardenSpace);

// ─── Protected Routes (Vendor / Admin only) ───────────────────────────────────

router.post(
  '/',
  authenticate,
  isAdminOrVendor,
  validate(createGardenSpaceSchema),
  gardenSpaceController.createGardenSpace,
);
router.patch(
  '/:id',
  authenticate,
  isAdminOrVendor,
  validate(updateGardenSpaceSchema),
  gardenSpaceController.updateGardenSpace,
);
router.delete(
  '/:id',
  authenticate,
  isAdminOrVendor,
  validate(deleteGardenSpaceSchema),
  gardenSpaceController.deleteGardenSpace,
);

export default router;
