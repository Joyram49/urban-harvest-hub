import { BookingStatus } from '@prisma/client';
import { z } from 'zod';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const createBookingSchema = z.object({
  body: z
    .object({
      gardenSpaceId: z.string().trim().min(1, 'Garden space ID is required'),
      startDate: z.coerce.date({ error: 'Invalid start date' }),
      endDate: z.coerce.date({ error: 'Invalid end date' }),
      notes: z.string().trim().max(500).optional(),
    })
    .refine((data) => data.endDate > data.startDate, {
      message: 'End date must be after start date',
      path: ['endDate'],
    }),
});

export const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      BookingStatus.APPROVED,
      BookingStatus.REJECTED,
      BookingStatus.ACTIVE,
      BookingStatus.COMPLETED,
    ]),
    vendorNotes: z.string().trim().max(500).optional(),
    rejectionReason: z.string().trim().max(500).optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Booking ID is required'),
  }),
});

export const cancelBookingSchema = z.object({
  body: z.object({
    cancelReason: z.string().trim().max(500).optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Booking ID is required'),
  }),
});

export const bookingListQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(BookingStatus).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateBookingInput = z.infer<typeof createBookingSchema>['body'];
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>['body'];
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>['body'];
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>['query'];
