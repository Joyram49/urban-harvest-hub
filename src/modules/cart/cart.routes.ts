import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/modules/auth/auth.middleware';
import * as cartController from '@/modules/cart/cart.controller';
import {
  addToCartSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from '@/modules/cart/cart.types';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// ─── Cart ─────────────────────────────────────────────────────────────────────
router.get('/', cartController.getCart);
router.post('/', validate(addToCartSchema), cartController.addToCart);
router.delete('/', cartController.clearCart);

// ─── Cart Items ───────────────────────────────────────────────────────────────
router.patch('/items/:itemId', validate(updateCartItemSchema), cartController.updateCartItem);
router.delete('/items/:itemId', validate(removeCartItemSchema), cartController.removeCartItem);

export default router;
