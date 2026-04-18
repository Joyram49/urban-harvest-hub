import { CertificationStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const uploadCertificationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
    issuedBy: z.string().trim().min(2, 'Issuing authority must be at least 2 characters').max(200),
    certNumber: z.string().trim().max(100).optional(),
    issuedAt: z.coerce.date({ error: 'issuedAt must be a valid date' }),
    expiresAt: z.coerce.date().optional(),
    documentUrl: z.string().trim().url('documentUrl must be a valid URL'),
  }),
});

export const reviewCertificationSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Certification ID is required'),
  }),
  body: z.object({
    status: z.enum([CertificationStatus.APPROVED, CertificationStatus.REJECTED], {
      error: 'Status must be APPROVED or REJECTED',
    }),
    reviewNotes: z.string().trim().max(1000).optional(),
    rejectionReason: z.string().trim().max(1000).optional(),
  }),
});

export const certificationParamsSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Certification ID is required'),
  }),
});

export const listCertificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    status: z.enum(CertificationStatus).optional(),
    vendorId: z.string().trim().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type UploadCertificationInput = z.infer<typeof uploadCertificationSchema>['body'];
export type ReviewCertificationInput = z.infer<typeof reviewCertificationSchema>['body'];
export type CertificationParams = z.infer<typeof certificationParamsSchema>['params'];
export type ListCertificationsQuery = z.infer<typeof listCertificationsQuerySchema>['query'];
