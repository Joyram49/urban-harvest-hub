import {
  type CertificationStatus,
  type Prisma,
  type UserRole,
  type UserStatus,
  type VendorStatus,
} from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { ForbiddenError, NotFoundError } from '@/errors/AppError';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type {
  ListCertificationsQuery,
  ListUsersQuery,
  ListVendorsQuery,
  ReviewCertificationInput,
  UpdateUserStatusInput,
  UpdateVendorStatusInput,
} from './admin.types';
import type { Request } from 'express';

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<Record<string, unknown>> {
  const [
    totalUsers,
    totalVendors,
    totalFarms,
    totalProducts,
    totalBookings,
    totalOrders,
    pendingVendors,
    pendingCertifications,
    usersByRole,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.farm.count(),
    prisma.product.count(),
    prisma.booking.count(),
    prisma.order.count(),
    prisma.vendor.count({ where: { status: 'PENDING' } }),
    prisma.certification.count({ where: { status: 'PENDING' } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const roleBreakdown = usersByRole.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = item._count._all;
    return acc;
  }, {});

  return {
    overview: {
      totalUsers,
      totalVendors,
      totalFarms,
      totalProducts,
      totalBookings,
      totalOrders,
    },
    pendingActions: {
      pendingVendors,
      pendingCertifications,
    },
    usersByRole: roleBreakdown,
    recentUsers,
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(
  query: ListUsersQuery,
  req: Request,
): Promise<{ data: unknown[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { role, status, search } = query;

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as UserRole;
  if (status) where.status = status as UserStatus;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: { id: true, businessName: true, status: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, meta: buildMeta(total, page, limit) };
}

export async function getUserById(id: string): Promise<unknown> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      vendor: {
        select: {
          id: true,
          businessName: true,
          status: true,
          city: true,
          country: true,
          avgRating: true,
          totalReviews: true,
        },
      },
      _count: {
        select: {
          orders: true,
          bookings: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function updateUserStatus(
  userId: string,
  input: UpdateUserStatusInput,
  adminId: string,
): Promise<unknown> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  // Prevent admin from suspending themselves
  if (userId === adminId) {
    throw new ForbiddenError('You cannot change your own account status');
  }

  // Prevent suspending other admins
  if (user.role === 'ADMIN' && input.status === 'SUSPENDED') {
    throw new ForbiddenError('Admin accounts cannot be suspended through this endpoint');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: input.status as UserStatus },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });

  logger.info(
    `Admin ${adminId} updated user ${userId} status → ${input.status}${input.reason ? ` (reason: ${input.reason})` : ''}`,
  );

  return updated;
}

// ─── Vendors ──────────────────────────────────────────────────────────────────

export async function listVendors(
  query: ListVendorsQuery,
  req: Request,
): Promise<{ data: unknown[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { status, search } = query;

  const where: Prisma.VendorWhereInput = {};
  if (status) where.status = status as VendorStatus;
  if (search) {
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        description: true,
        address: true,
        city: true,
        state: true,
        country: true,
        logoUrl: true,
        status: true,
        rejectionReason: true,
        approvedAt: true,
        avgRating: true,
        totalReviews: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        },
        _count: {
          select: { farms: true, products: true, certifications: true },
        },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  return { data: vendors, meta: buildMeta(total, page, limit) };
}

export async function getVendorById(id: string): Promise<unknown> {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
        },
      },
      farms: {
        select: {
          id: true,
          name: true,
          city: true,
          country: true,
          isOrganic: true,
          createdAt: true,
        },
      },
      certifications: {
        select: { id: true, title: true, issuedBy: true, status: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: {
        select: { farms: true, products: true, certifications: true, reviews: true },
      },
    },
  });

  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
}

export async function updateVendorStatus(
  vendorId: string,
  input: UpdateVendorStatusInput,
  adminId: string,
): Promise<unknown> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFoundError('Vendor not found');

  const updateData: Prisma.VendorUpdateInput = {
    status: input.status as VendorStatus,
  };

  if (input.status === 'APPROVED') {
    updateData.approvedAt = new Date();
    updateData.approvedBy = adminId;
    updateData.rejectionReason = null;
  } else if (input.status === 'REJECTED') {
    updateData.rejectionReason = input.rejectionReason;
    updateData.approvedAt = null;
    updateData.approvedBy = null;
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: updateData,
    select: {
      id: true,
      businessName: true,
      status: true,
      rejectionReason: true,
      approvedAt: true,
      updatedAt: true,
    },
  });

  logger.info(`Admin ${adminId} updated vendor ${vendorId} status → ${input.status}`);
  return updated;
}

// ─── Certifications ───────────────────────────────────────────────────────────

export async function listCertifications(
  query: ListCertificationsQuery,
  req: Request,
): Promise<{ data: unknown[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { status } = query;

  const where: Prisma.CertificationWhereInput = {};
  if (status) where.status = status as CertificationStatus;

  const [certifications, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        issuedBy: true,
        certNumber: true,
        issuedAt: true,
        expiresAt: true,
        documentUrl: true,
        status: true,
        reviewedAt: true,
        reviewNotes: true,
        rejectionReason: true,
        createdAt: true,
        vendor: {
          select: { id: true, businessName: true, city: true, country: true, logoUrl: true },
        },
      },
    }),
    prisma.certification.count({ where }),
  ]);

  return { data: certifications, meta: buildMeta(total, page, limit) };
}

export async function getCertificationById(id: string): Promise<unknown> {
  const cert = await prisma.certification.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          city: true,
          country: true,
          logoUrl: true,
          status: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!cert) throw new NotFoundError('Certification not found');
  return cert;
}

export async function reviewCertification(
  certId: string,
  input: ReviewCertificationInput,
  adminId: string,
): Promise<unknown> {
  const cert = await prisma.certification.findUnique({ where: { id: certId } });
  if (!cert) throw new NotFoundError('Certification not found');

  const updated = await prisma.certification.update({
    where: { id: certId },
    data: {
      status: input.status as CertificationStatus,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      reviewNotes: input.reviewNotes ?? null,
      rejectionReason: input.status === 'REJECTED' ? (input.rejectionReason ?? null) : null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      reviewedAt: true,
      reviewNotes: true,
      rejectionReason: true,
      vendor: { select: { id: true, businessName: true } },
    },
  });

  logger.info(`Admin ${adminId} reviewed certification ${certId} → ${input.status}`);
  return updated;
}

// ─── Forum Moderation ─────────────────────────────────────────────────────────

export async function listForumReports(
  req: Request,
): Promise<{ data: unknown[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip } = getPaginationOptions(req);

  const where = { isResolved: false };

  const [reports, total] = await Promise.all([
    prisma.forumReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reason: true,
        details: true,
        isResolved: true,
        reporterId: true,
        createdAt: true,
        post: {
          select: { id: true, title: true, authorId: true, createdAt: true },
        },
        comment: {
          select: { id: true, content: true, authorId: true, postId: true },
        },
      },
    }),
    prisma.forumReport.count({ where }),
  ]);

  return { data: reports, meta: buildMeta(total, page, limit) };
}

export async function resolveForumReport(reportId: string, adminId: string): Promise<unknown> {
  const report = await prisma.forumReport.findUnique({ where: { id: reportId } });
  if (!report) throw new NotFoundError('Report not found');

  const updated = await prisma.forumReport.update({
    where: { id: reportId },
    data: { isResolved: true, resolvedBy: adminId, resolvedAt: new Date() },
    select: { id: true, isResolved: true, resolvedAt: true, resolvedBy: true },
  });

  logger.info(`Admin ${adminId} resolved forum report ${reportId}`);
  return updated;
}

export async function deleteForumPost(postId: string, adminId: string): Promise<void> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  await prisma.forumPost.delete({ where: { id: postId } });
  logger.info(`Admin ${adminId} deleted forum post ${postId}`);
}

export async function pinForumPost(
  postId: string,
  isPinned: boolean,
  adminId: string,
): Promise<unknown> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  const updated = await prisma.forumPost.update({
    where: { id: postId },
    data: { isPinned },
    select: { id: true, title: true, isPinned: true },
  });

  logger.info(`Admin ${adminId} ${isPinned ? 'pinned' : 'unpinned'} forum post ${postId}`);
  return updated;
}

export async function lockForumPost(
  postId: string,
  isLocked: boolean,
  adminId: string,
): Promise<unknown> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  const updated = await prisma.forumPost.update({
    where: { id: postId },
    data: { isLocked },
    select: { id: true, title: true, isLocked: true },
  });

  logger.info(`Admin ${adminId} ${isLocked ? 'locked' : 'unlocked'} forum post ${postId}`);
  return updated;
}
