import { MESSAGES } from '@/constants/messages.constants';
import { UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as cartService from '@/modules/cart/cart.service';
import type { AddToCartInput, UpdateCartItemInput } from '@/modules/cart/cart.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

// ─── GET /cart ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get current user's cart
 *     description: Returns the authenticated user's cart with all items, product details, and computed summary totals. Auto-creates an empty cart if one does not yet exist.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 statusCode: { type: integer, example: 200 }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     userId: { type: string }
 *                     items: { type: array }
 *                     summary:
 *                       type: object
 *                       properties:
 *                         itemCount: { type: integer }
 *                         totalQuantity: { type: integer }
 *                         subtotal: { type: number }
 *                         unavailableItems: { type: integer }
 *       401:
 *         description: Unauthorized
 */
export const getCart = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const cart = await cartService.getCart(req.user.id);
  sendSuccess(res, { message: MESSAGES.CART.FETCHED, data: cart });
});

// ─── POST /cart ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /cart:
 *   post:
 *     summary: Add a product to the cart
 *     description: Adds a product to the cart. If the product is already in the cart, the quantity is incremented. Validates stock availability.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to add
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 1
 *     responses:
 *       200:
 *         description: Item added to cart — returns updated cart
 *       400:
 *         description: Product out of stock or quantity exceeds available stock
 *       404:
 *         description: Product not found
 */
export const addToCart = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const cart = await cartService.addToCart(req.user.id, req.body as AddToCartInput);
  sendSuccess(res, { message: MESSAGES.CART.ITEM_ADDED, data: cart });
});

// ─── PATCH /cart/items/:itemId ────────────────────────────────────────────────

/**
 * @swagger
 * /cart/items/{itemId}:
 *   patch:
 *     summary: Update quantity of a cart item
 *     description: Sets the exact quantity for a cart item. Must not exceed available stock. To remove, use the DELETE endpoint instead.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *         description: Cart item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Cart item updated — returns updated cart
 *       400:
 *         description: Quantity exceeds available stock
 *       403:
 *         description: Item does not belong to this user's cart
 *       404:
 *         description: Cart item not found
 */
export const updateCartItem = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['itemId'];
  const itemId = Array.isArray(rawId) ? rawId[0] : rawId;
  const cart = await cartService.updateCartItem(
    req.user.id,
    itemId,
    req.body as UpdateCartItemInput,
  );
  sendSuccess(res, { message: MESSAGES.CART.ITEM_UPDATED, data: cart });
});

// ─── DELETE /cart/items/:itemId ───────────────────────────────────────────────

/**
 * @swagger
 * /cart/items/{itemId}:
 *   delete:
 *     summary: Remove an item from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *         description: Cart item ID
 *     responses:
 *       200:
 *         description: Item removed — returns updated cart
 *       403:
 *         description: Item does not belong to this user's cart
 *       404:
 *         description: Cart item not found
 */
export const removeCartItem = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['itemId'];
  const itemId = Array.isArray(rawId) ? rawId[0] : rawId;
  const cart = await cartService.removeCartItem(req.user.id, itemId);
  sendSuccess(res, { message: MESSAGES.CART.ITEM_REMOVED, data: cart });
});

// ─── DELETE /cart ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /cart:
 *   delete:
 *     summary: Clear the entire cart
 *     description: Removes all items from the cart. The cart record itself is preserved.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared — returns empty cart
 *       401:
 *         description: Unauthorized
 */
export const clearCart = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const cart = await cartService.clearCart(req.user.id);
  sendSuccess(res, { message: 'Cart cleared successfully', data: cart });
});
