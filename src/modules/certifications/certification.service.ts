import { CertificationStatus, UserRole } from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { ForbiddenError, NotFoundError, BadRequestError } from '@/errors/AppError';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type {
  ListCertificationsQuery,
  ReviewCertificationInput,
  UploadCertificationInput,
} from './certification.types';
import type { Request } from 'express';

// ─── Upload Certification ─────────────────────────────────────────────────────

export async function uploadCertification(
  vendorId: string,
  input: UploadCertificationInput,
): Promise<object> {
  // Ensure vendor exists
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  const certification = await prisma.certification.create({
    data: {
      vendorId,
      title: input.title,
      issuedBy: input.issuedBy,
      certNumber: input.certNumber,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      documentUrl: input.documentUrl,
      status: CertificationStatus.PENDING,
    },
  });

  logger.info(`Certification uploaded: ${certification.id} for vendor ${vendorId}`);
  return certification;
}

// ─── Get My Certifications (Vendor) ──────────────────────────────────────────

export async function getMyCertifications(
  vendorId: string,
  req: Request,
): Promise<{ certifications: object[]; meta: object }> {
  const { page, limit, skip } = getPaginationOptions(req);

  const where = { vendorId };

  const [certifications, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.certification.count({ where }),
  ]);

  return { certifications, meta: buildMeta(total, page, limit) };
}

// ─── Get Single Certification ─────────────────────────────────────────────────

export async function getCertificationById(
  certId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<object> {
  const cert = await prisma.certification.findUnique({
    where: { id: certId },
    include: { vendor: { select: { id: true, userId: true, businessName: true } } },
  });

  if (!cert) throw new NotFoundError('Certification not found');

  // Vendor can only view their own; admin can view any
  if (requesterRole !== UserRole.ADMIN && cert.vendor.userId !== requesterId) {
    throw new ForbiddenError('You do not have access to this certification');
  }

  return cert;
}

// ─── Delete Certification (Vendor, only if PENDING) ───────────────────────────

export async function deleteCertification(
  certId: string,
  requesterId: string,
): Promise<{ message: string }> {
  const cert = await prisma.certification.findUnique({
    where: { id: certId },
    include: { vendor: { select: { userId: true } } },
  });

  if (!cert) throw new NotFoundError('Certification not found');
  if (cert.vendor.userId !== requesterId) {
    throw new ForbiddenError('You do not have permission to delete this certification');
  }
  if (cert.status !== CertificationStatus.PENDING) {
    throw new BadRequestError('Only certifications with PENDING status can be deleted');
  }

  await prisma.certification.delete({ where: { id: certId } });
  logger.info(`Certification deleted: ${certId}`);
  return { message: 'Certification deleted successfully' };
}

// ─── Admin: List All Certifications ──────────────────────────────────────────

export async function adminListCertifications(
  query: ListCertificationsQuery,
  req: Request,
): Promise<{ certifications: object[]; meta: object }> {
  const { page, limit, skip } = getPaginationOptions(req);

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.vendorId && { vendorId: query.vendorId }),
  };

  const [certifications, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.certification.count({ where }),
  ]);

  return { certifications, meta: buildMeta(total, page, limit) };
}

// ─── Admin: Review Certification ─────────────────────────────────────────────

export async function reviewCertification(
  certId: string,
  adminId: string,
  input: ReviewCertificationInput,
): Promise<object> {
  const cert = await prisma.certification.findUnique({ where: { id: certId } });
  if (!cert) throw new NotFoundError('Certification not found');

  if (cert.status !== CertificationStatus.PENDING) {
    throw new BadRequestError('Only PENDING certifications can be reviewed');
  }

  if (input.status === CertificationStatus.REJECTED && !input.rejectionReason) {
    throw new BadRequestError('A rejection reason is required when rejecting a certification');
  }

  const updated = await prisma.certification.update({
    where: { id: certId },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      reviewNotes: input.reviewNotes,
      rejectionReason: input.status === CertificationStatus.REJECTED ? input.rejectionReason : null,
    },
  });

  logger.info(`Certification ${certId} ${input.status} by admin ${adminId}`);
  return updated;
}
