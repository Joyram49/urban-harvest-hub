/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { z } from 'zod';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().trim().min(1, 'Product ID is required'),
    quantity: z.coerce
      .number()
      .int('Quantity must be a whole number')
      .min(1, 'Quantity must be at least 1')
      .max(100, 'Quantity cannot exceed 100 per item')
      .default(1),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: z.coerce
      .number()
      .int('Quantity must be a whole number')
      .min(1, 'Quantity must be at least 1')
      .max(100, 'Quantity cannot exceed 100 per item'),
  }),
  params: z.object({
    itemId: z.string().trim().min(1, 'Cart item ID is required'),
  }),
});

export const removeCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().trim().min(1, 'Cart item ID is required'),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type AddToCartInput = z.infer<typeof addToCartSchema>['body'];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ICartItemProduct {
  id: string;
  name: string;
  slug: string;
  price: unknown; // Prisma Decimal — serialises as string in JSON
  comparePrice: unknown | null;
  imageUrl: string | null;
  stock: number;
  unit: string;
  status: string;
  isOrganic: boolean;
  isCertified: boolean;
  vendor: {
    id: string;
    businessName: string;
  };
}

export interface ICartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  product: ICartItemProduct;
}

export interface ICart {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  items: ICartItem[];
  /** Computed totals — derived in service layer */
  summary: ICartSummary;
}

export interface ICartSummary {
  itemCount: number; // total distinct products
  totalQuantity: number; // sum of all quantities
  subtotal: number; // sum of (price * qty) for available items
  unavailableItems: number; // items whose product is OUT_OF_STOCK or ARCHIVED
}
