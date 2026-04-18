import {
  BookingStatus,
  GardenSpaceStatus,
  NotificationType,
  Prisma,
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
  CancelBookingInput,
  CreateBookingInput,
  UpdateBookingStatusInput,
} from './booking.types';
import type { Request } from 'express';
// ─── Create Booking (Customer) ────────────────────────────────────────────────

export async function createBooking(
  input: CreateBookingInput,
  customerId: string,
): Promise<object> {
  const gardenSpace = await prisma.gardenSpace.findUnique({
    where: { id: input.gardenSpaceId },
    include: { farm: { include: { vendor: true } } },
  });

  if (!gardenSpace) {
    throw new NotFoundError('Garden space not found');
  }

  if (gardenSpace.status !== GardenSpaceStatus.AVAILABLE) {
    throw new BadRequestError('This garden space is not available for booking');
  }

  // Check for overlapping bookings
  const overlap = await prisma.booking.findFirst({
    where: {
      gardenSpaceId: input.gardenSpaceId,
      status: { in: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.ACTIVE] },
      AND: [{ startDate: { lte: input.endDate } }, { endDate: { gte: input.startDate } }],
    },
  });

  if (overlap) {
    throw new BadRequestError('This garden space is already booked for the selected dates');
  }

  // Calculate duration in months
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const monthsCount = Math.max(
    1,
    Math.round(
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()),
    ),
  );

  const pricePerMonth = gardenSpace.pricePerMonth;
  const totalAmount = new Prisma.Decimal(pricePerMonth).mul(monthsCount);

  const booking = await prisma.booking.create({
    data: {
      customerId,
      gardenSpaceId: input.gardenSpaceId,
      startDate: input.startDate,
      endDate: input.endDate,
      monthsCount,
      pricePerMonth,
      totalAmount,
      notes: input.notes,
      status: BookingStatus.PENDING,
    },
    include: {
      gardenSpace: {
        include: { farm: { select: { name: true, vendorId: true } } },
      },
      customer: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  // Notify vendor
  const vendorUserId = gardenSpace.farm.vendor.userId;
  await createNotification({
    userId: vendorUserId,
    type: NotificationType.BOOKING_UPDATE,
    title: 'New Booking Request',
    message: `You have a new booking request for ${gardenSpace.name}`,
    data: { bookingId: booking.id },
    actionUrl: `/bookings/${booking.id}`,
  });

  socketEmit.toUser(vendorUserId, 'booking:new', { bookingId: booking.id });

  logger.info(`Booking created: ${booking.id} by customer ${customerId}`);
  return booking;
}

// ─── Get All Bookings (filtered by role) ─────────────────────────────────────

export async function getBookings(
  req: Request,
  userId: string,
  role: UserRole,
): Promise<{ data: object[]; meta: object }> {
  const { page, limit, skip } = getPaginationOptions(req);
  const { status } = req.query as { status?: BookingStatus };

  const where: Prisma.BookingWhereInput = {};

  if (role === UserRole.CUSTOMER) {
    where.customerId = userId;
  } else if (role === UserRole.VENDOR) {
    // Vendor sees bookings for their garden spaces
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new NotFoundError('Vendor profile not found');

    where.gardenSpace = {
      farm: { vendorId: vendor.id },
    };
  }
  // ADMIN sees all — no additional filter

  if (status) {
    where.status = status;
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        gardenSpace: {
          select: {
            name: true,
            size: true,
            pricePerMonth: true,
            farm: { select: { name: true, city: true } },
          },
        },
        customer: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        plantTracking: { select: { id: true, cropName: true, stage: true, healthStatus: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return { data: bookings, meta: buildMeta(total, page, limit) };
}

// ─── Get Single Booking ───────────────────────────────────────────────────────

export async function getBookingById(
  bookingId: string,
  userId: string,
  role: UserRole,
): Promise<object> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      gardenSpace: {
        include: {
          farm: {
            include: { vendor: { select: { id: true, businessName: true, userId: true } } },
          },
        },
      },
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      plantTracking: { include: { plantUpdates: { orderBy: { createdAt: 'desc' }, take: 5 } } },
      extraCosts: true,
    },
  });

  if (!booking) throw new NotFoundError('Booking not found');

  // Access control
  await assertBookingAccess(booking, userId, role);

  return booking;
}

// ─── Update Booking Status (Vendor/Admin) ─────────────────────────────────────

export async function updateBookingStatus(
  bookingId: string,
  input: UpdateBookingStatusInput,
  userId: string,
  role: UserRole,
): Promise<object> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      gardenSpace: { include: { farm: { include: { vendor: true } } } },
    },
  });

  if (!booking) throw new NotFoundError('Booking not found');

  // Vendor can only manage their own bookings
  if (role === UserRole.VENDOR) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (vendor?.id !== booking.gardenSpace.farm.vendorId) {
      throw new ForbiddenError('You can only manage bookings for your own garden spaces');
    }
  }

  // Validate status transitions
  validateStatusTransition(booking.status, input.status);

  // Validate rejection reason
  if (input.status === BookingStatus.REJECTED && !input.rejectionReason) {
    throw new BadRequestError('Rejection reason is required');
  }

  const updateData: Parameters<typeof prisma.booking.update>[0]['data'] = {
    status: input.status,
    vendorNotes: input.vendorNotes,
  };

  if (input.status === BookingStatus.APPROVED) {
    updateData.approvedAt = new Date();
  }

  if (input.status === BookingStatus.REJECTED) {
    updateData.rejectionReason = input.rejectionReason;
  }

  // Mark garden space as booked when booking is approved
  if (input.status === BookingStatus.APPROVED) {
    await prisma.gardenSpace.update({
      where: { id: booking.gardenSpaceId },
      data: { status: GardenSpaceStatus.BOOKED },
    });
  }

  // Free up space when rejected or completed
  if (input.status === BookingStatus.REJECTED || input.status === BookingStatus.COMPLETED) {
    await prisma.gardenSpace.update({
      where: { id: booking.gardenSpaceId },
      data: { status: GardenSpaceStatus.AVAILABLE },
    });
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: updateData,
    include: {
      gardenSpace: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  // Notify customer
  await createNotification({
    userId: booking.customerId,
    type: NotificationType.BOOKING_UPDATE,
    title: `Booking ${input.status.charAt(0) + input.status.slice(1).toLowerCase()}`,
    message: `Your booking for ${booking.gardenSpace.name} has been ${input.status.toLowerCase()}`,
    data: { bookingId: booking.id, status: input.status },
    actionUrl: `/bookings/${booking.id}`,
  });

  socketEmit.toUser(booking.customerId, 'booking:statusUpdated', {
    bookingId: booking.id,
    status: input.status,
  });

  logger.info(`Booking ${bookingId} status → ${input.status} by user ${userId}`);
  return updated;
}

// ─── Cancel Booking ────────────────────────────────────────────────────────────

export async function cancelBooking(
  bookingId: string,
  input: CancelBookingInput,
  userId: string,
  role: UserRole,
): Promise<object> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      gardenSpace: { include: { farm: { include: { vendor: true } } } },
    },
  });

  if (!booking) throw new NotFoundError('Booking not found');

  // Only customer (own), vendor (own space), or admin can cancel
  if (role === UserRole.CUSTOMER && booking.customerId !== userId) {
    throw new ForbiddenError('You can only cancel your own bookings');
  }

  if (role === UserRole.VENDOR) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (vendor?.id !== booking.gardenSpace.farm.vendorId) {
      throw new ForbiddenError('You can only cancel bookings for your own garden spaces');
    }
  }

  if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.APPROVED) {
    throw new BadRequestError(`Cannot cancel a booking with status: ${booking.status}`);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: input.cancelReason,
      cancelledBy: userId,
    },
  });

  // Free up garden space
  await prisma.gardenSpace.update({
    where: { id: booking.gardenSpaceId },
    data: { status: GardenSpaceStatus.AVAILABLE },
  });

  // Notify the other party
  const notifyUserId =
    role === UserRole.CUSTOMER ? booking.gardenSpace.farm.vendor.userId : booking.customerId;

  await createNotification({
    userId: notifyUserId,
    type: NotificationType.BOOKING_UPDATE,
    title: 'Booking Cancelled',
    message: `Booking for ${booking.gardenSpace.name} has been cancelled`,
    data: { bookingId: booking.id },
    actionUrl: `/bookings/${booking.id}`,
  });

  socketEmit.toUser(notifyUserId, 'booking:cancelled', { bookingId: booking.id });

  logger.info(`Booking ${bookingId} cancelled by user ${userId}`);
  return updated;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

type BookingWithRelations = Awaited<ReturnType<typeof prisma.booking.findUnique>> & {
  gardenSpace: {
    farm: {
      vendor: { userId: string };
    };
  };
};

async function assertBookingAccess(
  booking: BookingWithRelations | null,
  userId: string,
  role: UserRole,
): Promise<void> {
  if (!booking) throw new NotFoundError('Booking not found');

  if (role === UserRole.CUSTOMER && booking.customerId !== userId) {
    throw new ForbiddenError('You do not have access to this booking');
  }

  if (role === UserRole.VENDOR) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor || booking.gardenSpace.farm.vendor.userId !== userId) {
      throw new ForbiddenError('You do not have access to this booking');
    }
  }
}

function validateStatusTransition(current: BookingStatus, next: BookingStatus): void {
  const allowed: Partial<Record<BookingStatus, BookingStatus[]>> = {
    [BookingStatus.PENDING]: [BookingStatus.APPROVED, BookingStatus.REJECTED],
    [BookingStatus.APPROVED]: [BookingStatus.ACTIVE, BookingStatus.REJECTED],
    [BookingStatus.ACTIVE]: [BookingStatus.COMPLETED],
  };

  if (!allowed[current]?.includes(next)) {
    throw new BadRequestError(`Cannot transition booking from ${current} to ${next}`);
  }
}
