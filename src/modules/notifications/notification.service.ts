import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { socketEmit } from '@/config/socket';
import { NotFoundError, ForbiddenError } from '@/errors/AppError';
import type { IApiMeta } from '@/interfaces/response.interface';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type { ICreateNotificationPayload, ListNotificationsQuery } from './notification.types';
import type { Request } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// CORE HELPER — called by all other modules, never exposed via HTTP directly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a notification record in the database and immediately pushes it to
 * the recipient via Socket.IO (user:{userId} room).
 *
 * This is the single entry point for all notification creation across the app.
 * Import and call this from booking.service, order.service, etc.
 *
 * @example
 * await createNotification({
 *   userId: booking.customerId,
 *   type: NotificationType.BOOKING_UPDATE,
 *   title: 'Booking Approved',
 *   message: 'Your garden space booking has been approved.',
 *   actionUrl: `/bookings/${booking.id}`,
 *   data: { bookingId: booking.id },
 * });
 */
export async function createNotification(payload: ICreateNotificationPayload): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data ?? {},
        actionUrl: payload.actionUrl,
      },
    });

    // Push real-time event to the user's personal Socket.IO room
    socketEmit.toUser(payload.userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      isRead: false,
      createdAt: notification.createdAt,
    });

    logger.debug(`Notification sent [${payload.type}] → user:${payload.userId}`);
  } catch (err) {
    // Never let a notification failure crash the calling service
    logger.error('Failed to create notification:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USER-FACING SERVICE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserNotifications(
  userId: string,
  query: ListNotificationsQuery,
  req: Request,
): Promise<{ notifications: object[]; meta: IApiMeta }> {
  const { page, limit, skip } = getPaginationOptions(req);

  const where = {
    userId,
    ...(query.type && { type: query.type }),
    ...(query.isRead !== undefined && { isRead: query.isRead }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, meta: buildMeta(total, page, limit) };
}

export async function getUnreadCount(userId: string): Promise<{ count: number }> {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { count };
}

export async function markAsRead(notificationId: string, userId: string): Promise<object> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.userId !== userId) throw new ForbiddenError('Access denied');
  if (notification.isRead) return notification; // already read — no-op

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
}

export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<{ message: string }> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.userId !== userId) throw new ForbiddenError('Access denied');

  await prisma.notification.delete({ where: { id: notificationId } });
  return { message: 'Notification deleted' };
}

export async function clearAllNotifications(userId: string): Promise<{ deleted: number }> {
  const result = await prisma.notification.deleteMany({ where: { userId } });
  return { deleted: result.count };
}
