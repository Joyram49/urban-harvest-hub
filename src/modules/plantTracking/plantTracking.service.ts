import {
  BookingStatus,
  NotificationType,
  PlantHealthStatus,
  PlantStage,
  type Prisma,
  UserRole,
} from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { socketEmit } from '@/config/socket';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import { createNotification } from '@/modules/notifications/notification.service';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type {
  AddPlantUpdateInput,
  CreatePlantTrackingInput,
  UpdatePlantTrackingInput,
} from './plantTracking.types';
import type { Request } from 'express';

// ─── Create Plant Tracking (Vendor) ──────────────────────────────────────────

export async function createPlantTracking(
  input: CreatePlantTrackingInput,
  userId: string,
): Promise<object> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      gardenSpace: { include: { farm: true } },
    },
  });

  if (!booking) throw new NotFoundError('Booking not found');

  // Ensure booking belongs to this vendor
  if (booking.gardenSpace.farm.vendorId !== vendor.id) {
    throw new ForbiddenError('You can only track plants for your own bookings');
  }

  // Booking must be approved or active
  const allowedStatuses: BookingStatus[] = [BookingStatus.APPROVED, BookingStatus.ACTIVE];

  if (!allowedStatuses.includes(booking.status)) {
    throw new BadRequestError('Plant tracking can only be started for approved or active bookings');
  }

  // Prevent duplicate tracking per booking
  const existing = await prisma.plantTracking.findUnique({ where: { bookingId: input.bookingId } });
  if (existing) {
    throw new BadRequestError('Plant tracking already exists for this booking');
  }

  // Activate booking when plant tracking begins
  if (booking.status === BookingStatus.APPROVED) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.ACTIVE },
    });
  }

  const tracking = await prisma.plantTracking.create({
    data: {
      bookingId: input.bookingId,
      cropName: input.cropName,
      cropVariety: input.cropVariety,
      plantedAt: input.plantedAt,
      estimatedHarvest: input.estimatedHarvest,
      notes: input.notes,
      stage: PlantStage.SEED,
      healthStatus: PlantHealthStatus.GOOD,
    },
    include: {
      booking: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  // Notify customer
  await createNotification({
    userId: booking.customerId,
    type: NotificationType.PLANT_UPDATE,
    title: 'Plant Tracking Started',
    message: `Farming has begun for your booking! Crop: ${input.cropName}`,
    data: { plantTrackingId: tracking.id, bookingId: booking.id },
    actionUrl: `/plants/${tracking.id}`,
  });

  socketEmit.toUser(booking.customerId, 'plant:trackingStarted', {
    plantTrackingId: tracking.id,
    cropName: input.cropName,
  });

  logger.info(`Plant tracking created: ${tracking.id} for booking ${input.bookingId}`);
  return tracking;
}

// ─── Get Plant Trackings (filtered by role) ───────────────────────────────────

export async function getPlantTrackings(
  req: Request,
  userId: string,
  role: UserRole,
): Promise<{ data: object[]; meta: object }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { stage, healthStatus } = req.query as {
    stage?: PlantStage;
    healthStatus?: PlantHealthStatus;
  };
  const where: Prisma.PlantTrackingWhereInput = {};
  if (role === UserRole.CUSTOMER) {
    where.booking = { customerId: userId };
  } else if (role === UserRole.VENDOR) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new NotFoundError('Vendor profile not found');
    where.booking = { gardenSpace: { farm: { vendorId: vendor.id } } };
  }
  // ADMIN sees all

  if (stage) where.stage = stage;
  if (healthStatus) where.healthStatus = healthStatus;

  const [trackings, total] = await Promise.all([
    prisma.plantTracking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            customer: { select: { firstName: true, lastName: true } },
            gardenSpace: { select: { name: true, farm: { select: { name: true } } } },
          },
        },
        plantUpdates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.plantTracking.count({ where }),
  ]);

  return { data: trackings, meta: buildMeta(total, page, limit) };
}

// ─── Get Single Plant Tracking ────────────────────────────────────────────────

export async function getPlantTrackingById(
  trackingId: string,
  userId: string,
  role: UserRole,
): Promise<object> {
  const tracking = await prisma.plantTracking.findUnique({
    where: { id: trackingId },
    include: {
      booking: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          gardenSpace: {
            include: {
              farm: {
                include: {
                  vendor: { select: { id: true, businessName: true, userId: true } },
                },
              },
            },
          },
        },
      },
      plantUpdates: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!tracking) throw new NotFoundError('Plant tracking not found');

  await assertPlantTrackingAccess(tracking, userId, role);

  return tracking;
}

// ─── Update Plant Tracking (Vendor) ──────────────────────────────────────────

export async function updatePlantTracking(
  trackingId: string,
  input: UpdatePlantTrackingInput,
  userId: string,
): Promise<object> {
  const tracking = await prisma.plantTracking.findUnique({
    where: { id: trackingId },
    include: { booking: { include: { gardenSpace: { include: { farm: true } } } } },
  });

  if (!tracking) throw new NotFoundError('Plant tracking not found');

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (tracking.booking.gardenSpace.farm.vendorId !== vendor?.id) {
    throw new ForbiddenError('You can only update plant tracking for your own bookings');
  }

  const updated = await prisma.plantTracking.update({
    where: { id: trackingId },
    data: { ...input },
  });

  logger.info(`Plant tracking ${trackingId} updated`);
  return updated;
}

// ─── Add Plant Update (Vendor) ────────────────────────────────────────────────

export async function addPlantUpdate(
  trackingId: string,
  input: AddPlantUpdateInput,
  userId: string,
): Promise<object> {
  const tracking = await prisma.plantTracking.findUnique({
    where: { id: trackingId },
    include: {
      booking: {
        include: {
          gardenSpace: { include: { farm: true } },
          customer: { select: { id: true, firstName: true } },
        },
      },
    },
  });

  if (!tracking) throw new NotFoundError('Plant tracking not found');

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (tracking.booking.gardenSpace.farm.vendorId !== vendor?.id) {
    throw new ForbiddenError('You can only add updates for your own plant tracking records');
  }

  // Create update and bump plant tracking stage/health in one transaction
  const [update] = await prisma.$transaction([
    prisma.plantUpdate.create({
      data: {
        plantTrackingId: trackingId,
        stage: input.stage,
        healthStatus: input.healthStatus,
        notes: input.notes,
        imageUrl: input.imageUrl,
        images: input.images ?? [],
        heightCm: input.heightCm,
      },
    }),
    prisma.plantTracking.update({
      where: { id: trackingId },
      data: {
        stage: input.stage,
        healthStatus: input.healthStatus,
        ...(input.stage === PlantStage.HARVESTED && {
          actualHarvest: new Date(),
        }),
      },
    }),
  ]);

  // Notify customer about plant update
  const customerId = tracking.booking.customer.id;
  const stageLabel = input.stage.charAt(0) + input.stage.slice(1).toLowerCase().replace('_', ' ');

  await createNotification({
    userId: customerId,
    type: NotificationType.PLANT_UPDATE,
    title: 'Plant Growth Update',
    message: `Your crop "${tracking.cropName}" is now at ${stageLabel} stage. Health: ${input.healthStatus}`,
    data: {
      plantTrackingId: tracking.id,
      updateId: update.id,
      stage: input.stage,
      healthStatus: input.healthStatus,
    },
    actionUrl: `/plants/${tracking.id}`,
  });

  socketEmit.toUser(customerId, 'plant:updated', {
    plantTrackingId: tracking.id,
    stage: input.stage,
    healthStatus: input.healthStatus,
    cropName: tracking.cropName,
  });

  logger.info(`Plant update added to tracking ${trackingId}: stage=${input.stage}`);
  return update;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

type TrackingWithRelations = {
  booking: {
    customerId: string;
    gardenSpace: {
      farm: {
        vendor: { userId: string };
      };
    };
  };
};

async function assertPlantTrackingAccess(
  tracking: TrackingWithRelations,
  userId: string,
  role: UserRole,
): Promise<void> {
  if (role === UserRole.CUSTOMER && tracking.booking.customerId !== userId) {
    throw new ForbiddenError('You do not have access to this plant tracking record');
  }

  if (role === UserRole.VENDOR) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    if (tracking.booking.gardenSpace.farm.vendor.userId !== userId) {
      throw new ForbiddenError('You do not have access to this plant tracking record');
    }
  }
}
