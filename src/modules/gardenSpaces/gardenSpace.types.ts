import { GardenSpaceStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Reusable price schema ────────────────────────────────────────────────────

const priceSchema = z.coerce
  .number()
  .positive('Price must be a positive number')
  .multipleOf(0.01, 'Price must have at most 2 decimal places');

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const createGardenSpaceSchema = z.object({
  body: z.object({
    farmId: z.string().trim().min(1, 'Farm ID is required'),
    name: z
      .string()
      .trim()
      .min(2, 'Space name must be at least 2 characters')
      .max(100, 'Space name must be at most 100 characters'),
    description: z.string().trim().max(1000).optional(),
    size: z.coerce.number().positive('Size must be a positive number'),
    pricePerMonth: priceSchema,
    features: z.array(z.string().trim()).default([]),
    maxCrops: z.coerce.number().int().positive().optional(),
  }),
});

export const updateGardenSpaceSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    size: z.coerce.number().positive().optional(),
    pricePerMonth: priceSchema.optional(),
    status: z.nativeEnum(GardenSpaceStatus).optional(),
    features: z.array(z.string().trim()).optional(),
    maxCrops: z.coerce.number().int().positive().optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Garden space ID is required'),
  }),
});

export const getGardenSpaceSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Garden space ID is required'),
  }),
});

export const deleteGardenSpaceSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Garden space ID is required'),
  }),
});

export const listGardenSpacesQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    farmId: z.string().trim().optional(),
    status: z.enum(GardenSpaceStatus).optional(),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    minSize: z.coerce.number().positive().optional(),
    maxSize: z.coerce.number().positive().optional(),
    search: z.string().trim().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateGardenSpaceInput = z.infer<typeof createGardenSpaceSchema>['body'];
export type UpdateGardenSpaceInput = z.infer<typeof updateGardenSpaceSchema>['body'];
export type ListGardenSpacesQuery = z.infer<typeof listGardenSpacesQuerySchema>['query'];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface IGardenSpaceResponse {
  id: string;
  farmId: string;
  name: string;
  description: string | null;
  size: number;
  pricePerMonth: string; // Decimal serializes as string in JSON
  status: GardenSpaceStatus;
  imageUrl: string | null;
  images: string[];
  features: string[];
  maxCrops: number | null;
  createdAt: Date;
  updatedAt: Date;
  farm?: {
    id: string;
    name: string;
    city: string;
    country: string;
    isOrganic: boolean;
    vendor: {
      id: string;
      businessName: string;
    };
  };
}
