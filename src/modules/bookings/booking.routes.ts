import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdminOrVendor, isCustomer } from '@/modules/auth/auth.middleware';
import * as bookingController from '@/modules/bookings/booking.controller';
import {
  bookingListQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
  updateBookingStatusSchema,
} from '@/modules/bookings/booking.types';

const router = Router();

// All booking routes require authentication
router.use(authenticate);

// ─── Customer Routes ──────────────────────────────────────────────────────────

router.post('/', isCustomer, validate(createBookingSchema), bookingController.createBooking);

// ─── Shared Routes (Customer, Vendor, Admin) ──────────────────────────────────

router.get('/', validate(bookingListQuerySchema), bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);

// ─── Vendor / Admin Routes ────────────────────────────────────────────────────

router.patch(
  '/:id/status',
  isAdminOrVendor,
  validate(updateBookingStatusSchema),
  bookingController.updateBookingStatus,
);

// Cancel is accessible to all roles (service layer enforces ownership)
router.patch('/:id/cancel', validate(cancelBookingSchema), bookingController.cancelBooking);

export default router;
