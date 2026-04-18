import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdmin, isVendor } from '@/modules/auth/auth.middleware';
import * as productController from '@/modules/products/product.controller';
import {
  createCategorySchema,
  createProductSchema,
  getProductsQuerySchema,
  updateCategorySchema,
  updateProductSchema,
  updateStockSchema,
} from '@/modules/products/product.types';

const router = Router();

// ─── Category Routes ──────────────────────────────────────────────────────────

/** Public: browse categories */
router.get('/categories', productController.getAllCategories);
router.get('/categories/:id', productController.getCategoryById);

/** Admin only: manage categories */
router.post(
  '/categories',
  authenticate,
  isAdmin,
  validate(createCategorySchema),
  productController.createCategory,
);
router.patch(
  '/categories/:id',
  authenticate,
  isAdmin,
  validate(updateCategorySchema),
  productController.updateCategory,
);

// ─── Product Routes ───────────────────────────────────────────────────────────

/** Vendor only: view and manage their own products */
router.get(
  '/my',
  authenticate,
  isVendor,
  validate(getProductsQuerySchema),
  productController.getMyProducts,
);
router.post(
  '/',
  authenticate,
  isVendor,
  validate(createProductSchema),
  productController.createProduct,
);
router.patch(
  '/:id',
  authenticate,
  isVendor,
  validate(updateProductSchema),
  productController.updateProduct,
);
router.patch(
  '/:id/stock',
  authenticate,
  isVendor,
  validate(updateStockSchema),
  productController.updateProductStock,
);
router.delete('/:id', authenticate, isVendor, productController.deleteProduct);

/** Public: browse products */
router.get('/', validate(getProductsQuerySchema), productController.getProducts);
router.get('/slug/:slug', productController.getProductBySlug);
router.get('/:id', productController.getProductById);

export default router;
