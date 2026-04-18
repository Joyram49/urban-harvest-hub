import { OrderStatus, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().trim().min(5, 'Phone number is required'),
  addressLine1: z.string().trim().min(5, 'Address is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().min(2, 'Country is required'),
});

export const placeOrderSchema = z.object({
  body: z.object({
    shippingAddress: shippingAddressSchema,
    notes: z.string().trim().max(500).optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(
      [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
      ],
      { message: 'Invalid order status' },
    ),
    cancelReason: z.string().trim().max(500).optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Order ID is required'),
  }),
});

export const getOrdersQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z
      .enum([
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ])
      .optional(),
    paymentStatus: z
      .enum([
        PaymentStatus.PENDING,
        PaymentStatus.PAID,
        PaymentStatus.FAILED,
        PaymentStatus.REFUNDED,
      ])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>['body'];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>['body'];
export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>['query'];

// ─── Shipping Address ─────────────────────────────────────────────────────────

export interface IShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface IOrderItem {
  id: string;
  orderId: string;
  productId: string;
  vendorId: string;
  quantity: number;
  unitPrice: unknown; // Prisma Decimal
  totalPrice: unknown;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    unit: string;
  };
  vendor: {
    id: string;
    businessName: string;
  };
}

export interface IOrder {
  id: string;
  customerId: string;
  orderNumber: string;
  totalAmount: unknown;
  discountAmount: unknown;
  shippingAmount: unknown;
  grandTotal: unknown;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentRef: string | null;
  shippingAddress: unknown; // JSON
  notes: string | null;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderItems: IOrderItem[];
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}
