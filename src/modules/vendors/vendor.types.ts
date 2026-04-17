import { VendorStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const createVendorSchema = z.object({
  body: z.object({
    businessName: z
      .string()
      .trim()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name must be at most 100 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must be at most 1000 characters')
      .optional(),
    address: z.string().trim().min(5, 'Address must be at least 5 characters').max(255),
    city: z.string().trim().min(2, 'City must be at least 2 characters').max(100),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().min(2, 'Country must be at least 2 characters').max(100),
    postalCode: z.string().trim().max(20).optional(),
    website: z.string().trim().url('Website must be a valid URL').optional(),
    socialLinks: z
      .object({
        facebook: z.url().optional(),
        instagram: z.url().optional(),
        twitter: z.url().optional(),
        youtube: z.url().optional(),
      })
      .optional(),
  }),
});

export const updateVendorSchema = z.object({
  body: z
    .object({
      businessName: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(1000).optional(),
      address: z.string().trim().min(5).max(255).optional(),
      city: z.string().trim().min(2).max(100).optional(),
      state: z.string().trim().max(100).optional(),
      country: z.string().trim().min(2).max(100).optional(),
      postalCode: z.string().trim().max(20).optional(),
      website: z.string().trim().url('Website must be a valid URL').optional(),
      socialLinks: z
        .object({
          facebook: z.url().optional(),
          instagram: z.url().optional(),
          twitter: z.url().optional(),
          youtube: z.url().optional(),
        })
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const updateVendorLogoSchema = z.object({
  body: z.object({
    logoUrl: z.string().trim().url('logoUrl must be a valid URL'),
  }),
});

export const updateVendorCoverSchema = z.object({
  body: z.object({
    coverImageUrl: z.string().trim().url('coverImageUrl must be a valid URL'),
  }),
});

export const updateVendorStatusSchema = z.object({
  body: z.object({
    status: z.enum([VendorStatus.APPROVED, VendorStatus.REJECTED, VendorStatus.SUSPENDED], {
      message: 'Status must be APPROVED, REJECTED, or SUSPENDED',
    }),
    rejectionReason: z.string().trim().min(10).max(500).optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Vendor ID is required'),
  }),
});

export const getVendorsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z
      .enum([
        VendorStatus.PENDING,
        VendorStatus.APPROVED,
        VendorStatus.REJECTED,
        VendorStatus.SUSPENDED,
      ])
      .optional(),
    city: z.string().trim().optional(),
    search: z.string().trim().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateVendorInput = z.infer<typeof createVendorSchema>['body'];
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>['body'];
export type UpdateVendorLogoInput = z.infer<typeof updateVendorLogoSchema>['body'];
export type UpdateVendorCoverInput = z.infer<typeof updateVendorCoverSchema>['body'];
export type UpdateVendorStatusInput = z.infer<typeof updateVendorStatusSchema>['body'];
export type GetVendorsQuery = z.infer<typeof getVendorsQuerySchema>['query'];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface IVendorProfile {
  id: string;
  userId: string;
  businessName: string;
  description: string | null;
  address: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  website: string | null;
  socialLinks: unknown;
  status: VendorStatus;
  rejectionReason: string | null;
  approvedAt: Date | null;
  avgRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface IPublicVendorProfile {
  id: string;
  businessName: string;
  description: string | null;
  city: string;
  country: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  website: string | null;
  avgRating: number;
  totalReviews: number;
  createdAt: Date;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}
