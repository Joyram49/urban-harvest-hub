import { z } from 'zod';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const createFarmSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Farm name must be at least 2 characters')
      .max(100, 'Farm name must be at most 100 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must be at most 1000 characters')
      .optional(),
    address: z.string().trim().min(5, 'Address must be at least 5 characters'),
    city: z.string().trim().min(2, 'City is required'),
    state: z.string().trim().optional(),
    country: z.string().trim().min(2, 'Country is required'),
    postalCode: z.string().trim().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    totalArea: z.coerce.number().positive('Total area must be a positive number').optional(),
    soilType: z.string().trim().optional(),
    waterSource: z.string().trim().optional(),
    isOrganic: z.boolean().default(false),
  }),
});

export const updateFarmSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Farm name must be at least 2 characters')
      .max(100, 'Farm name must be at most 100 characters')
      .optional(),
    description: z.string().trim().max(1000).optional(),
    address: z.string().trim().min(5).optional(),
    city: z.string().trim().min(2).optional(),
    state: z.string().trim().optional(),
    country: z.string().trim().min(2).optional(),
    postalCode: z.string().trim().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    totalArea: z.coerce.number().positive().optional(),
    soilType: z.string().trim().optional(),
    waterSource: z.string().trim().optional(),
    isOrganic: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Farm ID is required'),
  }),
});

export const getFarmSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Farm ID is required'),
  }),
});

export const deleteFarmSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Farm ID is required'),
  }),
});

export const listFarmsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    city: z.string().trim().optional(),
    country: z.string().trim().optional(),
    isOrganic: z
      .string()
      .optional()
      .transform((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }),
    search: z.string().trim().optional(),
    vendorId: z.string().trim().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateFarmInput = z.infer<typeof createFarmSchema>['body'];
export type UpdateFarmInput = z.infer<typeof updateFarmSchema>['body'];
export type ListFarmsQuery = z.infer<typeof listFarmsQuerySchema>['query'];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface IFarmResponse {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  images: string[];
  totalArea: number | null;
  soilType: string | null;
  waterSource: string | null;
  isOrganic: boolean;
  avgRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}
