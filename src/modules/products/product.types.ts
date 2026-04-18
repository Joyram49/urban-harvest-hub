/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable no-nested-ternary */
import { ProductStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  body: z.object({
    categoryId: z.string().trim().min(1, 'Category ID is required'),
    name: z
      .string()
      .trim()
      .min(2, 'Product name must be at least 2 characters')
      .max(150, 'Product name must be at most 150 characters'),
    description: z
      .string()
      .trim()
      .max(2000, 'Description must be at most 2000 characters')
      .optional(),
    price: z.coerce
      .number({ message: 'Price must be a number' })
      .positive('Price must be greater than 0')
      .multipleOf(0.01, 'Price must have at most 2 decimal places'),
    comparePrice: z.coerce
      .number()
      .positive('Compare price must be greater than 0')
      .multipleOf(0.01)
      .optional()
      .nullable(),
    stock: z.coerce.number().int().min(0, 'Stock must be 0 or greater').default(0),
    lowStockAt: z.coerce.number().int().min(1, 'Low stock threshold must be at least 1').default(5),
    unit: z.string().trim().min(1, 'Unit is required').max(30).default('piece'),
    imageUrl: z.string().trim().url('imageUrl must be a valid URL').optional().nullable(),
    images: z.array(z.string().trim().url('Each image must be a valid URL')).max(10).optional(),
    isOrganic: z.boolean().default(false),
  }),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      categoryId: z.string().trim().min(1).optional(),
      name: z.string().trim().min(2).max(150).optional(),
      description: z.string().trim().max(2000).optional().nullable(),
      price: z.coerce.number().positive().multipleOf(0.01).optional(),
      comparePrice: z.coerce.number().positive().multipleOf(0.01).optional().nullable(),
      stock: z.coerce.number().int().min(0).optional(),
      lowStockAt: z.coerce.number().int().min(1).optional(),
      unit: z.string().trim().min(1).max(30).optional(),
      imageUrl: z.string().trim().url().optional().nullable(),
      images: z.array(z.string().trim().url()).max(10).optional(),
      isOrganic: z.boolean().optional(),
      status: z
        .enum([ProductStatus.ACTIVE, ProductStatus.ARCHIVED, ProductStatus.OUT_OF_STOCK])
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
  params: z.object({
    id: z.string().trim().min(1, 'Product ID is required'),
  }),
});

export const getProductsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    categoryId: z.string().trim().optional(),
    vendorId: z.string().trim().optional(),
    status: z
      .enum([ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK, ProductStatus.ARCHIVED])
      .optional(),
    isOrganic: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    isCertified: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    search: z.string().trim().optional(),
    sortBy: z
      .enum(['price', 'createdAt', 'avgRating', 'totalSold'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const updateStockSchema = z.object({
  body: z.object({
    stock: z.coerce.number().int().min(0, 'Stock must be 0 or greater'),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Product ID is required'),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Category name must be at least 2 characters')
      .max(80, 'Category name must be at most 80 characters'),
    description: z.string().trim().max(500).optional(),
    imageUrl: z.string().trim().url().optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).default(0),
  }),
});

export const updateCategorySchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      description: z.string().trim().max(500).optional().nullable(),
      imageUrl: z.string().trim().url().optional().nullable(),
      sortOrder: z.coerce.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
  params: z.object({
    id: z.string().trim().min(1, 'Category ID is required'),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>['query'];
export type UpdateStockInput = z.infer<typeof updateStockSchema>['body'];
export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface IProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  id: string;
  vendorId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  price: unknown; // Prisma Decimal
  comparePrice: unknown | null;
  stock: number;
  lowStockAt: number;
  unit: string;
  imageUrl: string | null;
  images: string[];
  isCertified: boolean;
  isOrganic: boolean;
  status: ProductStatus;
  avgRating: number;
  totalReviews: number;
  totalSold: number;
  createdAt: Date;
  updatedAt: Date;
  category: Pick<IProductCategory, 'id' | 'name' | 'slug'>;
  vendor: {
    id: string;
    businessName: string;
    logoUrl: string | null;
    avgRating: number;
  };
}
