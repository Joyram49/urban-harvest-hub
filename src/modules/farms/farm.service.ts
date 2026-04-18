import { type Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { ForbiddenError, NotFoundError } from '@/errors/AppError';
import { type IPaginationOptions } from '@/utils/pagination';

import {
  type CreateFarmInput,
  type IFarmResponse,
  type ListFarmsQuery,
  type UpdateFarmInput,
} from './farm.types';

// ─── Select helper ────────────────────────────────────────────────────────────

const farmSelect = {
  id: true,
  vendorId: true,
  name: true,
  description: true,
  address: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  imageUrl: true,
  images: true,
  totalArea: true,
  soilType: true,
  waterSource: true,
  isOrganic: true,
  avgRating: true,
  totalReviews: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FarmSelect;

// ─── Create Farm ──────────────────────────────────────────────────────────────

export async function createFarm(vendorId: string, input: CreateFarmInput): Promise<IFarmResponse> {
  const farm = await prisma.farm.create({
    data: {
      vendorId,
      name: input.name,
      description: input.description,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      latitude: input.latitude,
      longitude: input.longitude,
      totalArea: input.totalArea,
      soilType: input.soilType,
      waterSource: input.waterSource,
      isOrganic: input.isOrganic,
    },
    select: farmSelect,
  });

  return farm;
}

// ─── Get Farm By ID ───────────────────────────────────────────────────────────

export async function getFarmById(id: string): Promise<IFarmResponse> {
  const farm = await prisma.farm.findUnique({
    where: { id },
    select: farmSelect,
  });

  if (!farm) throw new NotFoundError('Farm not found');

  return farm;
}

// ─── List Farms ───────────────────────────────────────────────────────────────

export async function listFarms(
  query: ListFarmsQuery,
  pagination: IPaginationOptions,
): Promise<{ farms: IFarmResponse[]; total: number }> {
  const where: Prisma.FarmWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }

  if (query.country) {
    where.country = { contains: query.country, mode: 'insensitive' };
  }

  if (query.isOrganic !== undefined) {
    where.isOrganic = query.isOrganic;
  }

  if (query.vendorId) {
    where.vendorId = query.vendorId;
  }

  const [farms, total] = await prisma.$transaction([
    prisma.farm.findMany({
      where,
      select: farmSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.farm.count({ where }),
  ]);

  return { farms, total };
}

// ─── Update Farm ──────────────────────────────────────────────────────────────

export async function updateFarm(
  id: string,
  vendorId: string,
  input: UpdateFarmInput,
): Promise<IFarmResponse> {
  const existing = await prisma.farm.findUnique({ where: { id } });

  if (!existing) throw new NotFoundError('Farm not found');
  if (existing.vendorId !== vendorId) {
    throw new ForbiddenError('You do not have permission to update this farm');
  }

  const farm = await prisma.farm.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
      ...(input.latitude !== undefined && { latitude: input.latitude }),
      ...(input.longitude !== undefined && { longitude: input.longitude }),
      ...(input.totalArea !== undefined && { totalArea: input.totalArea }),
      ...(input.soilType !== undefined && { soilType: input.soilType }),
      ...(input.waterSource !== undefined && { waterSource: input.waterSource }),
      ...(input.isOrganic !== undefined && { isOrganic: input.isOrganic }),
    },
    select: farmSelect,
  });

  return farm;
}

// ─── Delete Farm ──────────────────────────────────────────────────────────────

export async function deleteFarm(id: string, vendorId: string): Promise<void> {
  const existing = await prisma.farm.findUnique({ where: { id } });

  if (!existing) throw new NotFoundError('Farm not found');
  if (existing.vendorId !== vendorId) {
    throw new ForbiddenError('You do not have permission to delete this farm');
  }

  await prisma.farm.delete({ where: { id } });
}

// ─── Get Farms by Vendor ──────────────────────────────────────────────────────

export async function getFarmsByVendor(
  vendorId: string,
  pagination: IPaginationOptions,
): Promise<{ farms: IFarmResponse[]; total: number }> {
  const [farms, total] = await prisma.$transaction([
    prisma.farm.findMany({
      where: { vendorId },
      select: farmSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.farm.count({ where: { vendorId } }),
  ]);

  return { farms, total };
}
