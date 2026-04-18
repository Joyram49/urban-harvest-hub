import { CertificationStatus, UserStatus, VendorStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Query Schemas ────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    role: z.enum(['ADMIN', 'VENDOR', 'CUSTOMER']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'UNVERIFIED']).optional(),
    search: z.string().trim().optional(),
  }),
});

export const listVendorsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
    search: z.string().trim().optional(),
  }),
});

export const listCertificationsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
  }),
});

// ─── Action Schemas ───────────────────────────────────────────────────────────

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED], {
      error: 'Status must be ACTIVE or SUSPENDED',
    }),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const updateVendorStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vendor ID is required'),
  }),
  body: z
    .object({
      status: z.enum([VendorStatus.APPROVED, VendorStatus.REJECTED, VendorStatus.SUSPENDED], {
        error: 'Status must be APPROVED, REJECTED, or SUSPENDED',
      }),
      rejectionReason: z.string().trim().max(1000).optional(),
    })
    .refine(
      (data) => {
        if (data.status === VendorStatus.REJECTED && !data.rejectionReason) {
          return false;
        }
        return true;
      },
      {
        message: 'Rejection reason is required when rejecting a vendor',
        path: ['rejectionReason'],
      },
    ),
});

export const reviewCertificationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Certification ID is required'),
  }),
  body: z
    .object({
      status: z.enum([CertificationStatus.APPROVED, CertificationStatus.REJECTED], {
        error: 'Status must be APPROVED or REJECTED',
      }),
      reviewNotes: z.string().trim().max(1000).optional(),
      rejectionReason: z.string().trim().max(1000).optional(),
    })
    .refine(
      (data) => {
        if (data.status === CertificationStatus.REJECTED && !data.rejectionReason) {
          return false;
        }
        return true;
      },
      {
        message: 'Rejection reason is required when rejecting a certification',
        path: ['rejectionReason'],
      },
    ),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type ListUsersQuery = z.infer<typeof listUsersSchema>['query'];
export type ListVendorsQuery = z.infer<typeof listVendorsSchema>['query'];
export type ListCertificationsQuery = z.infer<typeof listCertificationsSchema>['query'];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type UpdateVendorStatusInput = z.infer<typeof updateVendorStatusSchema>['body'];
export type ReviewCertificationInput = z.infer<typeof reviewCertificationSchema>['body'];
