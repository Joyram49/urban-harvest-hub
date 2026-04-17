import { type VendorStatus } from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import { type UserRole } from '@/interfaces/request.interface';
import {
  type CreateVendorInput,
  type GetVendorsQuery,
  type IPublicVendorProfile,
  type IVendorProfile,
  type UpdateVendorCoverInput,
  type UpdateVendorInput,
  type UpdateVendorLogoInput,
  type UpdateVendorStatusInput,
} from '@/modules/vendors/vendor.types';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type { Request } from 'express';

// ─── Selectors ────────────────────────────────────────────────────────────────

const fullVendorSelect = {
  id: true,
  userId: true,
  businessName: true,
  description: true,
  address: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  logoUrl: true,
  coverImageUrl: true,
  website: true,
  socialLinks: true,
  status: true,
  rejectionReason: true,
  approvedAt: true,
  avgRating: true,
  totalReviews: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
} as const;

const publicVendorSelect = {
  id: true,
  businessName: true,
  description: true,
  city: true,
  country: true,
  logoUrl: true,
  coverImageUrl: true,
  website: true,
  avgRating: true,
  totalReviews: true,
  createdAt: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
} as const;

// ─── Create Vendor Profile ────────────────────────────────────────────────────

export async function createVendor(
  userId: string,
  input: CreateVendorInput,
): Promise<IVendorProfile> {
  // Check user exists and has VENDOR role
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');
  if (user.role !== 'VENDOR') {
    throw new ForbiddenError('Only users with the VENDOR role can create a vendor profile');
  }

  // Prevent duplicate vendor profiles
  const existing = await prisma.vendor.findUnique({ where: { userId } });
  if (existing) {
    throw new ConflictError('You already have a vendor profile');
  }

  const vendor = await prisma.vendor.create({
    data: {
      userId,
      businessName: input.businessName,
      description: input.description,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      website: input.website,
      socialLinks: input.socialLinks ?? undefined,
    },
    select: fullVendorSelect,
  });

  logger.info(`Vendor profile created: ${vendor.businessName} (userId: ${userId})`);
  return vendor;
}

// ─── Get My Vendor Profile ────────────────────────────────────────────────────

export async function getMyVendorProfile(userId: string): Promise<IVendorProfile> {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    select: fullVendorSelect,
  });

  if (!vendor) throw new NotFoundError('Vendor profile not found');
  return vendor;
}

// ─── Update Vendor Profile ────────────────────────────────────────────────────

export async function updateVendorProfile(
  userId: string,
  input: UpdateVendorInput,
): Promise<IVendorProfile> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  // Suspended vendors cannot update their profile
  if (vendor.status === 'SUSPENDED') {
    throw new ForbiddenError('Suspended vendors cannot update their profile');
  }

  const updated = await prisma.vendor.update({
    where: { userId },
    data: {
      ...(input.businessName !== undefined && { businessName: input.businessName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
      ...(input.website !== undefined && { website: input.website }),
      ...(input.socialLinks !== undefined && { socialLinks: input.socialLinks }),
    },
    select: fullVendorSelect,
  });

  logger.info(`Vendor profile updated: ${updated.businessName} (userId: ${userId})`);
  return updated;
}

// ─── Update Vendor Logo ───────────────────────────────────────────────────────

export async function updateVendorLogo(
  userId: string,
  input: UpdateVendorLogoInput,
): Promise<IVendorProfile> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  const updated = await prisma.vendor.update({
    where: { userId },
    data: { logoUrl: input.logoUrl },
    select: fullVendorSelect,
  });

  logger.info(`Vendor logo updated: ${vendor.businessName}`);
  return updated;
}

// ─── Update Vendor Cover Image ────────────────────────────────────────────────

export async function updateVendorCover(
  userId: string,
  input: UpdateVendorCoverInput,
): Promise<IVendorProfile> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  const updated = await prisma.vendor.update({
    where: { userId },
    data: { coverImageUrl: input.coverImageUrl },
    select: fullVendorSelect,
  });

  logger.info(`Vendor cover updated: ${vendor.businessName}`);
  return updated;
}

// ─── Get Vendor By ID ─────────────────────────────────────────────────────────

export async function getVendorById(
  requesterId: string,
  requesterRole: UserRole,
  vendorId: string,
): Promise<IVendorProfile | IPublicVendorProfile> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: requesterRole === 'ADMIN' ? fullVendorSelect : publicVendorSelect,
  });

  if (!vendor) throw new NotFoundError('Vendor not found');

  // Non-admin users can only see approved vendors (unless it's their own profile)
  if (requesterRole !== 'ADMIN') {
    const fullVendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (fullVendor?.status !== 'APPROVED' && fullVendor?.userId !== requesterId) {
      throw new NotFoundError('Vendor not found');
    }
  }

  return vendor;
}

// ─── Get All Vendors ──────────────────────────────────────────────────────────

export async function getAllVendors(
  req: Request,
  query: GetVendorsQuery,
  requesterRole: UserRole,
): Promise<{
  vendors: (IVendorProfile | IPublicVendorProfile)[];
  meta: ReturnType<typeof buildMeta>;
}> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { status, city, search } = query;

  // Non-admins only see approved vendors
  const statusFilter = requesterRole === 'ADMIN' ? status : ('APPROVED' as VendorStatus);

  const where = {
    ...(statusFilter && { status: statusFilter }),
    ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
    ...(search && {
      OR: [
        { businessName: { contains: search, mode: 'insensitive' as const } },
        { city: { contains: search, mode: 'insensitive' as const } },
        { country: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const selectFields = requesterRole === 'ADMIN' ? fullVendorSelect : publicVendorSelect;

  const [total, vendors] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.vendor.findMany({
      where,
      select: selectFields,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { vendors, meta: buildMeta(total, page, limit) };
}

// ─── Update Vendor Status (Admin Only) ───────────────────────────────────────

export async function updateVendorStatus(
  adminId: string,
  vendorId: string,
  input: UpdateVendorStatusInput,
): Promise<IVendorProfile> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFoundError('Vendor not found');

  if (vendor.status === input.status) {
    throw new ConflictError(`Vendor is already ${input.status.toLowerCase()}`);
  }

  // Rejection requires a reason
  if (input.status === 'REJECTED' && !input.rejectionReason) {
    throw new BadRequestError('A rejection reason is required when rejecting a vendor');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      status: input.status as VendorStatus,
      ...(input.status === 'APPROVED' && {
        approvedAt: new Date(),
        approvedBy: adminId,
        rejectionReason: null,
      }),
      ...(input.status === 'REJECTED' && {
        rejectionReason: input.rejectionReason,
        approvedAt: null,
        approvedBy: null,
      }),
      ...(input.status === 'SUSPENDED' && {
        rejectionReason: input.rejectionReason ?? null,
      }),
    },
    select: fullVendorSelect,
  });

  logger.info(
    `Vendor status updated to ${input.status}: ${vendor.businessName} (by admin ${adminId})`,
  );
  return updated;
}
