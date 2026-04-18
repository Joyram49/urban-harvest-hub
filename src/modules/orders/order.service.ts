/* eslint-disable max-lines-per-function */
import { type OrderStatus, type Prisma } from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import type {
  GetOrdersQuery,
  IOrder,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from '@/modules/orders/order.types';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type { Request } from 'express';

// ─── Selectors ────────────────────────────────────────────────────────────────

const orderItemSelect = {
  id: true,
  orderId: true,
  productId: true,
  vendorId: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  product: {
    select: { id: true, name: true, slug: true, imageUrl: true, unit: true },
  },
  vendor: {
    select: { id: true, businessName: true },
  },
} as const;

const orderSelect = {
  id: true,
  customerId: true,
  orderNumber: true,
  totalAmount: true,
  discountAmount: true,
  shippingAmount: true,
  grandTotal: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  paymentRef: true,
  shippingAddress: true,
  notes: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  orderItems: { select: orderItemSelect },
  customer: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a human-readable order number: UHH-20260418-XXXXX */
function generateOrderNumber(): string {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `UHH-${datePart}-${randomPart}`;
}

/**
 * Valid status transitions for orders.
 * Key = current status, Value = allowed next statuses.
 */
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

function assertValidTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestError(
      `Cannot transition order from "${current}" to "${next}". Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none'}`,
    );
  }
}

// ─── Place Order ──────────────────────────────────────────────────────────────

export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<IOrder> {
  // 1. Load cart with items
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendor: { select: { id: true, status: true } },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new BadRequestError('Your cart is empty. Add items before placing an order.');
  }

  // 2. Validate every item — stock, status, vendor approval
  const stockErrors: string[] = [];

  for (const item of cart.items) {
    const { product } = item;

    if (product.status === 'ARCHIVED') {
      stockErrors.push(`"${product.name}" is no longer available`);
      continue;
    }

    if (product.status === 'OUT_OF_STOCK' || product.stock < item.quantity) {
      const available = product.stock;
      stockErrors.push(
        available === 0
          ? `"${product.name}" is out of stock`
          : `"${product.name}" only has ${available} unit(s) available (you requested ${item.quantity})`,
      );
      continue;
    }

    if (product.vendor.status !== 'APPROVED') {
      stockErrors.push(`"${product.name}" is from a vendor that is no longer active`);
    }
  }

  if (stockErrors.length > 0) {
    throw new BadRequestError(
      `Cannot place order. Please resolve the following issues:\n• ${stockErrors.join('\n• ')}`,
    );
  }

  // 3. Compute totals
  let totalAmount = 0;
  for (const item of cart.items) {
    totalAmount += parseFloat(String(item.product.price)) * item.quantity;
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  const shippingAmount = 0; // Future: calculate shipping based on address/weight
  const discountAmount = 0; // Future: apply coupon codes
  const grandTotal = Math.round((totalAmount + shippingAmount - discountAmount) * 100) / 100;

  const orderNumber = generateOrderNumber();

  // 4. Create order + items + decrement stock — all in a transaction
  const order = await prisma.$transaction(async (tx) => {
    // Create the order
    const newOrder = await tx.order.create({
      data: {
        customerId: userId,
        orderNumber,
        totalAmount,
        discountAmount,
        shippingAmount,
        grandTotal,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
        notes: input.notes,
        orderItems: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            vendorId: item.product.vendor.id,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice:
              Math.round(parseFloat(String(item.product.price)) * item.quantity * 100) / 100,
          })),
        },
      },
      select: orderSelect,
    });

    // Decrement stock for each product
    for (const item of cart.items) {
      const newStock = item.product.stock - item.quantity;
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: newStock,
          status: newStock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
        },
      });
    }

    // Clear the cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return newOrder;
  });

  logger.info(`Order placed: ${orderNumber} by user ${userId} — grand total $${grandTotal}`);
  return order as IOrder;
}

// ─── Get My Orders (Customer) ─────────────────────────────────────────────────

export async function getMyOrders(
  req: Request,
  userId: string,
  query: GetOrdersQuery,
): Promise<{ orders: IOrder[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { status, paymentStatus, sortOrder } = query;

  const where: Prisma.OrderWhereInput = {
    customerId: userId,
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  return { orders: orders as IOrder[], meta: buildMeta(total, page, limit) };
}

// ─── Get Order By ID ──────────────────────────────────────────────────────────

export async function getOrderById(
  userId: string,
  userRole: string,
  orderId: string,
): Promise<IOrder> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: orderSelect,
  });

  if (!order) throw new NotFoundError('Order not found');

  // Customers can only see their own orders
  // Admins can see any order
  // Vendors can see orders containing their products (checked below)
  if (userRole === 'CUSTOMER' && order.customerId !== userId) {
    throw new ForbiddenError('You do not have permission to view this order');
  }

  if (userRole === 'VENDOR') {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    const hasItem = order.orderItems.some((item) => item.vendorId === vendor?.id);
    if (!hasItem) throw new ForbiddenError('You do not have permission to view this order');
  }

  return order as IOrder;
}

// ─── Get All Orders (Admin) ───────────────────────────────────────────────────

export async function getAllOrders(
  req: Request,
  query: GetOrdersQuery,
): Promise<{ orders: IOrder[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { status, paymentStatus, sortOrder } = query;

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  return { orders: orders as IOrder[], meta: buildMeta(total, page, limit) };
}

// ─── Get Vendor Orders ────────────────────────────────────────────────────────

export async function getVendorOrders(
  req: Request,
  userId: string,
  query: GetOrdersQuery,
): Promise<{ orders: IOrder[]; meta: ReturnType<typeof buildMeta> }> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  const { page, limit, skip } = getPaginationOptions(req);
  const { status, paymentStatus, sortOrder } = query;

  // Orders that contain at least one item from this vendor
  const where: Prisma.OrderWhereInput = {
    orderItems: { some: { vendorId: vendor.id } },
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  return { orders: orders as IOrder[], meta: buildMeta(total, page, limit) };
}

// ─── Update Order Status ──────────────────────────────────────────────────────

export async function updateOrderStatus(
  userId: string,
  userRole: string,
  orderId: string,
  input: UpdateOrderStatusInput,
): Promise<IOrder> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { ...orderSelect, status: true, customerId: true },
  });

  if (!order) throw new NotFoundError('Order not found');

  const nextStatus = input.status as OrderStatus;

  // Customers may only cancel their own pending orders
  if (userRole === 'CUSTOMER') {
    if (order.customerId !== userId) {
      throw new ForbiddenError('You do not have permission to update this order');
    }
    if (nextStatus !== 'CANCELLED') {
      throw new ForbiddenError('Customers may only cancel orders');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestError('Only pending orders can be cancelled by customers');
    }
  }

  // Vendors may confirm, prepare, ship orders containing their products
  if (userRole === 'VENDOR') {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    const hasItem = (order as IOrder).orderItems.some((item) => item.vendorId === vendor?.id);
    if (!hasItem) throw new ForbiddenError('You do not have permission to update this order');
    if (['DELIVERED', 'REFUNDED'].includes(nextStatus)) {
      throw new ForbiddenError('Vendors cannot mark orders as delivered or refunded');
    }
  }

  // Validate state machine transition
  assertValidTransition(order.status, nextStatus);

  // Build timestamp fields
  const now = new Date();
  const timestampUpdates: Partial<{
    confirmedAt: Date;
    shippedAt: Date;
    deliveredAt: Date;
    cancelledAt: Date;
    cancelReason: string;
  }> = {};

  if (nextStatus === 'CONFIRMED') timestampUpdates.confirmedAt = now;
  if (nextStatus === 'SHIPPED') timestampUpdates.shippedAt = now;
  if (nextStatus === 'DELIVERED') timestampUpdates.deliveredAt = now;
  if (nextStatus === 'CANCELLED') {
    timestampUpdates.cancelledAt = now;
    if (input.cancelReason) timestampUpdates.cancelReason = input.cancelReason;

    // Restore stock for cancelled orders
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (fullOrder) {
      await prisma.$transaction(
        fullOrder.orderItems.map((item) =>
          prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              status: 'ACTIVE',
            },
          }),
        ),
      );
    }
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      ...(nextStatus === 'DELIVERED' && { paymentStatus: 'PAID' }),
      ...timestampUpdates,
    },
    select: orderSelect,
  });

  logger.info(`Order ${order.orderNumber} → ${nextStatus} (by ${userRole} ${userId})`);
  return updated as IOrder;
}
