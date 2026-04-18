import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';

import type { NotificationType, Prisma } from '@prisma/client';

export interface ICreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Must be JSON-serializable (matches Prisma `Json` column). */
  data?: Prisma.InputJsonValue;
  actionUrl?: string;
}

/**
 * Create a notification record in the database.
 * Used internally by all modules that emit notifications.
 */
export async function createNotification(input: ICreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? {},
        actionUrl: input.actionUrl,
      },
    });
  } catch (error) {
    // Notifications should not crash the main flow
    logger.error('Failed to create notification:', error);
  }
}
