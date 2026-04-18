import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { UnauthorizedError } from '@/errors/AppError';
import type { IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as bookingService from '@/modules/bookings/booking.service';
import type {
  CancelBookingInput,
  CreateBookingInput,
  UpdateBookingStatusInput,
} from '@/modules/bookings/booking.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a new booking (Customer only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gardenSpaceId, startDate, endDate]
 *             properties:
 *               gardenSpaceId: { type: string }
 *               startDate:     { type: string, format: date }
 *               endDate:       { type: string, format: date }
 *               notes:         { type: string }
 *     responses:
 *       201:
 *         description: Booking created
 *       400:
 *         description: Space unavailable or date conflict
 *       404:
 *         description: Garden space not found
 */
export const createBooking = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const booking = await bookingService.createBooking(req.body as CreateBookingInput, req.user.id);
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.BOOKING.CREATED,
    data: booking,
  });
});

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Get bookings (filtered by role)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, ACTIVE, COMPLETED, CANCELLED, REJECTED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: List of bookings
 */
export const getBookings = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await bookingService.getBookings(req, req.user.id, req.user.role);
  sendSuccess(res, {
    message: MESSAGES.BOOKING.LIST_FETCHED,
    data: result.data,
    meta: result.meta as Parameters<typeof sendSuccess>[1]['meta'],
  });
});

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get a single booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Booking not found
 */
export const getBookingById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const booking = await bookingService.getBookingById(
    req.params['id'] as string,
    req.user.id,
    req.user.role,
  );
  sendSuccess(res, { message: MESSAGES.BOOKING.FETCHED, data: booking });
});

/**
 * @swagger
 * /bookings/{id}/status:
 *   patch:
 *     summary: Update booking status (Vendor/Admin)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:          { type: string, enum: [APPROVED, REJECTED, ACTIVE, COMPLETED] }
 *               vendorNotes:     { type: string }
 *               rejectionReason: { type: string }
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Access denied
 */
export const updateBookingStatus = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const updated = await bookingService.updateBookingStatus(
      req.params['id'] as string,
      req.body as UpdateBookingStatusInput,
      req.user.id,
      req.user.role,
    );
    sendSuccess(res, { message: MESSAGES.BOOKING.STATUS_UPDATED, data: updated });
  },
);

/**
 * @swagger
 * /bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancelReason: { type: string }
 *     responses:
 *       200:
 *         description: Booking cancelled
 *       400:
 *         description: Cannot cancel booking in current status
 *       403:
 *         description: Access denied
 */
export const cancelBooking = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const updated = await bookingService.cancelBooking(
    req.params['id'] as string,
    req.body as CancelBookingInput,
    req.user.id,
    req.user.role,
  );
  sendSuccess(res, { message: MESSAGES.BOOKING.CANCELLED, data: updated });
});
