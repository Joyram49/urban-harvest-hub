import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as orderService from '@/modules/orders/order.service';
import type {
  GetOrdersQuery,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from '@/modules/orders/order.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

// ─── POST /orders ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Place an order from the current cart
 *     description: >
 *       Converts the authenticated user's cart into an order.
 *       Validates stock for every item, decrements inventory, clears the cart,
 *       and returns the created order — all inside a single database transaction.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shippingAddress]
 *             properties:
 *               shippingAddress:
 *                 type: object
 *                 required: [fullName, phone, addressLine1, city, country]
 *                 properties:
 *                   fullName:     { type: string }
 *                   phone:        { type: string }
 *                   addressLine1: { type: string }
 *                   addressLine2: { type: string }
 *                   city:         { type: string }
 *                   state:        { type: string }
 *                   postalCode:   { type: string }
 *                   country:      { type: string }
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Order placed successfully
 *       400:
 *         description: Cart is empty, or one or more items are out of stock
 */
export const placeOrder = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const order = await orderService.placeOrder(req.user.id, req.body as PlaceOrderInput);
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.ORDER.CREATED,
    data: order,
  });
});

// ─── GET /orders/my ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /orders/my:
 *   get:
 *     summary: Get my orders (Customer)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, PREPARING, SHIPPED, DELIVERED, CANCELLED, REFUNDED] }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string, enum: [PENDING, PAID, FAILED, REFUNDED] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Orders fetched successfully
 */
export const getMyOrders = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { orders, meta } = await orderService.getMyOrders(
    req,
    req.user.id,
    req.query as GetOrdersQuery,
  );
  sendSuccess(res, { message: MESSAGES.ORDER.LIST_FETCHED, data: orders, meta });
});

// ─── GET /orders/vendor ───────────────────────────────────────────────────────

/**
 * @swagger
 * /orders/vendor:
 *   get:
 *     summary: Get orders containing this vendor's products (Vendor only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Vendor orders fetched successfully
 *       404:
 *         description: Vendor profile not found
 */
export const getVendorOrders = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { orders, meta } = await orderService.getVendorOrders(
    req,
    req.user.id,
    req.query as GetOrdersQuery,
  );
  sendSuccess(res, { message: MESSAGES.ORDER.LIST_FETCHED, data: orders, meta });
});

// ─── GET /orders (Admin) ──────────────────────────────────────────────────────

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: All orders fetched
 */
export const getAllOrders = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { orders, meta } = await orderService.getAllOrders(req, req.query as GetOrdersQuery);
  sendSuccess(res, { message: MESSAGES.ORDER.LIST_FETCHED, data: orders, meta });
});

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get an order by ID
 *     description: >
 *       Customers can only view their own orders.
 *       Vendors can only view orders that contain their products.
 *       Admins can view any order.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order fetched
 *       403:
 *         description: Not authorized to view this order
 *       404:
 *         description: Order not found
 */
export const getOrderById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const order = await orderService.getOrderById(req.user.id, req.user.role, id);
  sendSuccess(res, { message: MESSAGES.ORDER.FETCHED, data: order });
});

// ─── PATCH /orders/:id/status ─────────────────────────────────────────────────

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     description: >
 *       Enforces a strict state machine. Customers may only cancel PENDING orders.
 *       Vendors may confirm, prepare, and ship orders containing their products.
 *       Admins may make any valid transition. Cancelling an order restores product stock.
 *     tags: [Orders]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CONFIRMED, PREPARING, SHIPPED, DELIVERED, CANCELLED]
 *               cancelReason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Required when status is CANCELLED (optional but recommended)
 *     responses:
 *       200:
 *         description: Order status updated
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Not authorized to perform this status change
 *       404:
 *         description: Order not found
 */
export const updateOrderStatus = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const order = await orderService.updateOrderStatus(
    req.user.id,
    req.user.role,
    id,
    req.body as UpdateOrderStatusInput,
  );
  sendSuccess(res, { message: MESSAGES.ORDER.STATUS_UPDATED, data: order });
});
