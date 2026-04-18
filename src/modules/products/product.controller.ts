import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { BadRequestError, UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as productService from '@/modules/products/product.service';
import {
  getProductsQuerySchema,
  type CreateCategoryInput,
  type CreateProductInput,
  type GetProductsQuery,
  type UpdateCategoryInput,
  type UpdateProductInput,
  type UpdateStockInput,
} from '@/modules/products/product.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Request, Response } from 'express';

// ─── Category Controllers ─────────────────────────────────────────────────────

/**
 * @swagger
 * /products/categories:
 *   post:
 *     summary: Create a product category (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, minLength: 2, maxLength: 80 }
 *               description: { type: string, maxLength: 500 }
 *               imageUrl:    { type: string, format: uri }
 *               sortOrder:   { type: integer, minimum: 0 }
 *     responses:
 *       201:
 *         description: Category created
 *       409:
 *         description: Category already exists
 */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await productService.createCategory(req.body as CreateCategoryInput);
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Category created successfully',
    data: category,
  });
});

/**
 * @swagger
 * /products/categories:
 *   get:
 *     summary: Get all active categories
 *     tags: [Products]
 *     security: []
 *     responses:
 *       200:
 *         description: Categories fetched successfully
 */
export const getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await productService.getAllCategories();
  sendSuccess(res, { message: 'Categories fetched successfully', data: categories });
});

/**
 * @swagger
 * /products/categories/{id}:
 *   get:
 *     summary: Get a category by ID
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category fetched
 *       404:
 *         description: Category not found
 */
export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const category = await productService.getCategoryById(id);
  sendSuccess(res, { message: 'Category fetched successfully', data: category });
});

/**
 * @swagger
 * /products/categories/{id}:
 *   patch:
 *     summary: Update a category (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *               imageUrl:    { type: string, format: uri }
 *               sortOrder:   { type: integer }
 *               isActive:    { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated
 *       404:
 *         description: Category not found
 */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const category = await productService.updateCategory(id, req.body as UpdateCategoryInput);
  sendSuccess(res, { message: 'Category updated successfully', data: category });
});

// ─── Product Controllers ──────────────────────────────────────────────────────

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product (Vendor only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, name, price]
 *             properties:
 *               categoryId:   { type: string }
 *               name:         { type: string, minLength: 2, maxLength: 150 }
 *               description:  { type: string }
 *               price:        { type: number, minimum: 0.01 }
 *               comparePrice: { type: number }
 *               stock:        { type: integer, minimum: 0 }
 *               lowStockAt:   { type: integer, minimum: 1 }
 *               unit:         { type: string }
 *               imageUrl:     { type: string, format: uri }
 *               images:       { type: array, items: { type: string } }
 *               isOrganic:    { type: boolean }
 *     responses:
 *       201:
 *         description: Product created
 *       403:
 *         description: Vendor not approved
 */
export const createProduct = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const product = await productService.createProduct(req.user.id, req.body as CreateProductInput);
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.PRODUCT.CREATED,
    data: product,
  });
});

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products (public, with filters)
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: vendorId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, OUT_OF_STOCK, ARCHIVED] }
 *       - in: query
 *         name: isOrganic
 *         schema: { type: boolean }
 *       - in: query
 *         name: isCertified
 *         schema: { type: boolean }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [price, createdAt, avgRating, totalSold] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Products fetched successfully
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const querySchema = getProductsQuerySchema.shape.query;

  const result = querySchema.safeParse(req.query as unknown);

  if (!result.success) {
    throw new BadRequestError('Invalid query parameters');
  }

  const parsedQuery: GetProductsQuery = result.data;

  const { products, meta } = await productService.getProducts(req, parsedQuery);

  sendSuccess(res, {
    message: MESSAGES.PRODUCT.LIST_FETCHED,
    data: products,
    meta,
  });
});

/**
 * @swagger
 * /products/my:
 *   get:
 *     summary: Get my products (Vendor only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, OUT_OF_STOCK, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Vendor products fetched
 */
export const getMyProducts = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const querySchema = getProductsQuerySchema.shape.query;

  const result = querySchema.safeParse(req.query as unknown);

  if (!result.success) {
    throw new BadRequestError('Invalid query parameters');
  }

  const parsedQuery: GetProductsQuery = result.data;

  const { products, meta } = await productService.getProducts(req, parsedQuery);
  sendSuccess(res, { message: MESSAGES.PRODUCT.LIST_FETCHED, data: products, meta });
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product fetched
 *       404:
 *         description: Product not found
 */
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const product = await productService.getProductById(id);
  sendSuccess(res, { message: MESSAGES.PRODUCT.FETCHED, data: product });
});

/**
 * @swagger
 * /products/slug/{slug}:
 *   get:
 *     summary: Get a product by slug
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product fetched
 *       404:
 *         description: Product not found
 */
export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const rawSlug = req.params['slug'];
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const product = await productService.getProductBySlug(slug);
  sendSuccess(res, { message: MESSAGES.PRODUCT.FETCHED, data: product });
});

/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Update a product (Vendor — own products only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               price:       { type: number }
 *               stock:       { type: integer }
 *               status:      { type: string, enum: [ACTIVE, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Product updated
 *       403:
 *         description: Not the product owner
 *       404:
 *         description: Product not found
 */
export const updateProduct = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const product = await productService.updateProduct(
    req.user.id,
    id,
    req.body as UpdateProductInput,
  );
  sendSuccess(res, { message: MESSAGES.PRODUCT.UPDATED, data: product });
});

/**
 * @swagger
 * /products/{id}/stock:
 *   patch:
 *     summary: Update product stock (Vendor — own products only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stock]
 *             properties:
 *               stock: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Stock updated
 */
export const updateProductStock = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const rawId = req.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const product = await productService.updateProductStock(
      req.user.id,
      id,
      req.body as UpdateStockInput,
    );
    sendSuccess(res, { message: 'Stock updated successfully', data: product });
  },
);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Archive (soft-delete) a product (Vendor — own products only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product archived
 *       403:
 *         description: Not the product owner
 *       404:
 *         description: Product not found
 */
export const deleteProduct = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  await productService.deleteProduct(req.user.id, id);
  sendSuccess(res, { message: MESSAGES.PRODUCT.DELETED });
});
