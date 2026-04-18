import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdminOrVendor, isVendor } from '@/modules/auth/auth.middleware';

import * as farmController from './farm.controller';
import {
  createFarmSchema,
  deleteFarmSchema,
  getFarmSchema,
  listFarmsQuerySchema,
  updateFarmSchema,
} from './farm.types';

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

router.get('/', validate(listFarmsQuerySchema), farmController.listFarms);
router.get('/my-farms', authenticate, isVendor, farmController.getMyFarms);
router.get('/:id', validate(getFarmSchema), farmController.getFarm);

// ─── Protected Routes (Vendor only) ──────────────────────────────────────────

router.post(
  '/',
  authenticate,
  isAdminOrVendor,
  validate(createFarmSchema),
  farmController.createFarm,
);
router.patch(
  '/:id',
  authenticate,
  isAdminOrVendor,
  validate(updateFarmSchema),
  farmController.updateFarm,
);
router.delete(
  '/:id',
  authenticate,
  isAdminOrVendor,
  validate(deleteFarmSchema),
  farmController.deleteFarm,
);

export default router;
