import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdmin, isAdminOrVendor, isVendor } from '@/modules/auth/auth.middleware';
import * as orderController from '@/modules/orders/order.controller';
import {
  getOrdersQuerySchema,
  placeOrderSchema,
  updateOrderStatusSchema,
} from '@/modules/orders/order.types';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ─── Customer ─────────────────────────────────────────────────────────────────

/** Place a new order from the cart */
router.post('/', validate(placeOrderSchema), orderController.placeOrder);

/** Customer: view own orders */
router.get('/my', validate(getOrdersQuerySchema), orderController.getMyOrders);

// ─── Vendor ───────────────────────────────────────────────────────────────────

/** Vendor: view orders that contain their products */
router.get('/vendor', isVendor, validate(getOrdersQuerySchema), orderController.getVendorOrders);

// ─── Admin ────────────────────────────────────────────────────────────────────

/** Admin: view all orders */
router.get('/', isAdmin, validate(getOrdersQuerySchema), orderController.getAllOrders);

// ─── Shared: get by ID + status update ───────────────────────────────────────

/** Any authenticated user — ownership enforced in service */
router.get('/:id', orderController.getOrderById);

/** Customer (cancel own), Vendor (confirm/prepare/ship), Admin (any) */
router.patch(
  '/:id/status',
  isAdminOrVendor,
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

export default router;
