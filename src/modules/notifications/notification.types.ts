/* eslint-disable no-nested-ternary */
import { NotificationType, type Prisma } from '@prisma/client';
import { z } from 'zod';

// ─── Query Schemas ────────────────────────────────────────────────────────────

export const listNotificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(20).optional(),
    type: z.enum(NotificationType).optional(),
    isRead: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  }),
});

export const notificationParamsSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Notification ID is required'),
  }),
});

// ─── Internal payload type (used by other modules to fire notifications) ──────

export interface ICreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  actionUrl?: string;
}

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>['query'];
