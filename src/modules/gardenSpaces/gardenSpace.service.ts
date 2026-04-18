import { GardenSpaceStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import { type IPaginationOptions } from '@/utils/pagination';

import {
  type CreateGardenSpaceInput,
  type IGardenSpaceResponse,
  type ListGardenSpacesQuery,
  type UpdateGardenSpaceInput,
} from './gardenSpace.types';

// ─── Select helpers ───────────────────────────────────────────────────────────

const gardenSpaceSelect = {
  id: true,
  farmId: true,
  name: true,
  description: true,
  size: true,
  pricePerMonth: true,
  status: true,
  imageUrl: true,
  images: true,
  features: true,
  maxCrops: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GardenSpaceSelect;

const gardenSpaceWithFarmSelect = {
  ...gardenSpaceSelect,
  farm: {
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      isOrganic: true,
      vendor: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  },
} satisfies Prisma.GardenSpaceSelect;

type GardenSpaceQueryRow = Prisma.GardenSpaceGetPayload<{
  select: typeof gardenSpaceWithFarmSelect;
}>;
type GardenSpaceBasicRow = Prisma.GardenSpaceGetPayload<{
  select: typeof gardenSpaceSelect;
}>;

/** Prisma returns `Decimal` for money fields; API responses use string (JSON-safe). */
function toGardenSpaceResponse(
  space: GardenSpaceQueryRow | GardenSpaceBasicRow,
): IGardenSpaceResponse {
  return {
    ...space,
    pricePerMonth: space.pricePerMonth.toString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify that a farm exists and belongs to the given vendorId */
async function assertFarmOwnership(farmId: string, vendorId: string): Promise<void> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { vendorId: true },
  });
  if (!farm) throw new NotFoundError('Farm not found');
  if (farm.vendorId !== vendorId) {
    throw new ForbiddenError('You do not have permission to manage spaces on this farm');
  }
}

/** Verify that a garden space exists and its farm belongs to the given vendorId */
async function assertSpaceOwnership(spaceId: string, vendorId: string): Promise<void> {
  const space = await prisma.gardenSpace.findUnique({
    where: { id: spaceId },
    select: { farm: { select: { vendorId: true } } },
  });
  if (!space) throw new NotFoundError('Garden space not found');
  if (space.farm.vendorId !== vendorId) {
    throw new ForbiddenError('You do not have permission to manage this garden space');
  }
}

// ─── Create Garden Space ──────────────────────────────────────────────────────

export async function createGardenSpace(
  vendorId: string,
  input: CreateGardenSpaceInput,
): Promise<IGardenSpaceResponse> {
  await assertFarmOwnership(input.farmId, vendorId);

  const space = await prisma.gardenSpace.create({
    data: {
      farmId: input.farmId,
      name: input.name,
      description: input.description,
      size: input.size,
      pricePerMonth: input.pricePerMonth,
      features: input.features,
      maxCrops: input.maxCrops,
      status: GardenSpaceStatus.AVAILABLE,
    },
    select: gardenSpaceWithFarmSelect,
  });

  return toGardenSpaceResponse(space);
}

// ─── Get Garden Space By ID ───────────────────────────────────────────────────

export async function getGardenSpaceById(id: string): Promise<IGardenSpaceResponse> {
  const space = await prisma.gardenSpace.findUnique({
    where: { id },
    select: gardenSpaceWithFarmSelect,
  });

  if (!space) throw new NotFoundError('Garden space not found');

  return toGardenSpaceResponse(space);
}

// ─── List Garden Spaces ───────────────────────────────────────────────────────

export async function listGardenSpaces(
  query: ListGardenSpacesQuery,
  pagination: IPaginationOptions,
): Promise<{ spaces: IGardenSpaceResponse[]; total: number }> {
  const where: Prisma.GardenSpaceWhereInput = {};

  if (query.farmId) {
    where.farmId = query.farmId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.pricePerMonth = {};
    if (query.minPrice !== undefined) {
      where.pricePerMonth.gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      where.pricePerMonth.lte = query.maxPrice;
    }
  }

  if (query.minSize !== undefined || query.maxSize !== undefined) {
    where.size = {};
    if (query.minSize !== undefined) {
      where.size.gte = query.minSize;
    }
    if (query.maxSize !== undefined) {
      where.size.lte = query.maxSize;
    }
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [spaces, total] = await prisma.$transaction([
    prisma.gardenSpace.findMany({
      where,
      select: gardenSpaceWithFarmSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.gardenSpace.count({ where }),
  ]);

  return { spaces: spaces.map(toGardenSpaceResponse), total };
}

// ─── Update Garden Space ──────────────────────────────────────────────────────

export async function updateGardenSpace(
  id: string,
  vendorId: string,
  input: UpdateGardenSpaceInput,
): Promise<IGardenSpaceResponse> {
  await assertSpaceOwnership(id, vendorId);

  // Guard against manually setting a space to BOOKED via this endpoint
  if (input.status === GardenSpaceStatus.BOOKED) {
    throw new BadRequestError(
      'Cannot manually set status to BOOKED. This is managed by the booking system.',
    );
  }

  const space = await prisma.gardenSpace.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.size !== undefined && { size: input.size }),
      ...(input.pricePerMonth !== undefined && { pricePerMonth: input.pricePerMonth }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.features !== undefined && { features: input.features }),
      ...(input.maxCrops !== undefined && { maxCrops: input.maxCrops }),
    },
    select: gardenSpaceWithFarmSelect,
  });

  return toGardenSpaceResponse(space);
}

// ─── Delete Garden Space ──────────────────────────────────────────────────────

export async function deleteGardenSpace(id: string, vendorId: string): Promise<void> {
  await assertSpaceOwnership(id, vendorId);

  // Prevent deletion of an actively booked space
  const activeBooking = await prisma.booking.findFirst({
    where: {
      gardenSpaceId: id,
      status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
    },
    select: { id: true },
  });

  if (activeBooking) {
    throw new BadRequestError(
      'Cannot delete a garden space that has active or pending bookings. Cancel all bookings first.',
    );
  }

  await prisma.gardenSpace.delete({ where: { id } });
}

// ─── Get Spaces By Farm ───────────────────────────────────────────────────────

export async function getSpacesByFarm(
  farmId: string,
  pagination: IPaginationOptions,
): Promise<{ spaces: IGardenSpaceResponse[]; total: number }> {
  // Verify farm exists
  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
  if (!farm) throw new NotFoundError('Farm not found');

  const [spaces, total] = await prisma.$transaction([
    prisma.gardenSpace.findMany({
      where: { farmId },
      select: gardenSpaceSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.gardenSpace.count({ where: { farmId } }),
  ]);

  return { spaces: spaces.map(toGardenSpaceResponse), total };
}
