import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/modules/auth/auth.middleware';

import * as notificationController from './notification.controller';
import { listNotificationsQuerySchema, notificationParamsSchema } from './notification.types';

const router = Router();

// All notification routes require authentication — notifications are personal
router.use(authenticate);

// GET  /notifications              — list my notifications (filterable + paginated)
router.get('/', validate(listNotificationsQuerySchema), notificationController.getMyNotifications);

// GET  /notifications/unread-count — unread badge count
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /notifications/read-all   — mark ALL as read (must come before /:id routes)
router.patch('/read-all', notificationController.markAllAsRead);

// DELETE /notifications/clear-all — delete all notifications
router.delete('/clear-all', notificationController.clearAllNotifications);

// PATCH /notifications/:id/read   — mark a single notification as read
router.patch('/:id/read', validate(notificationParamsSchema), notificationController.markAsRead);

// DELETE /notifications/:id       — delete a single notification
router.delete(
  '/:id',
  validate(notificationParamsSchema),
  notificationController.deleteNotification,
);

export default router;
