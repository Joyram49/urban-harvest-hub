import { BadRequestError } from '@/errors/AppError';
import type { IAuthenticatedRequest } from '@/interfaces/request.interface';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import * as notificationService from './notification.service';
import { listNotificationsQuerySchema, type ListNotificationsQuery } from './notification.types';

import type { Response } from 'express';

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get my notifications (paginated)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BOOKING_UPDATE, PLANT_UPDATE, ORDER_UPDATE, CERTIFICATION_UPDATE, FORUM_ACTIVITY, PAYMENT_UPDATE, SYSTEM]
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: Paginated list of notifications
 */
export const getMyNotifications = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const querySchema = listNotificationsQuerySchema.shape.query;
    const result = querySchema.safeParse(req.query as unknown);
    if (!result.success) {
      throw new BadRequestError('Invalid query parameters');
    }
    const parsedQuery: ListNotificationsQuery = result.data;
    const { notifications, meta } = await notificationService.getUserNotifications(
      req.user?.id ?? '',
      parsedQuery,
      req,
    );

    sendSuccess(res, {
      message: 'Notifications fetched successfully',
      data: notifications,
      meta,
    });
  },
);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count (for badge)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count: { type: integer }
 */
export const getUnreadCount = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await notificationService.getUnreadCount(req.user?.id ?? '');
  sendSuccess(res, { message: 'Unread count fetched', data: result });
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       403:
 *         description: Access denied
 *       404:
 *         description: Notification not found
 */
export const markAsRead = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const notification = await notificationService.markAsRead(
    req.params.id as string,
    req.user?.id ?? '',
  );
  sendSuccess(res, { message: 'Notification marked as read', data: notification });
});

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updated: { type: integer }
 */
export const markAllAsRead = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await notificationService.markAllAsRead(req.user?.id ?? '');
  sendSuccess(res, {
    message: `${result.updated} notification(s) marked as read`,
    data: result,
  });
});

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a single notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 */
export const deleteNotification = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const result = await notificationService.deleteNotification(
      req.params.id as string,
      req.user?.id ?? '',
    );
    sendSuccess(res, { message: result.message });
  },
);

/**
 * @swagger
 * /notifications/clear-all:
 *   delete:
 *     summary: Clear all notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: integer }
 */
export const clearAllNotifications = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const result = await notificationService.clearAllNotifications(req.user?.id ?? '');
    sendSuccess(res, {
      message: `${result.deleted} notification(s) cleared`,
      data: result,
    });
  },
);
