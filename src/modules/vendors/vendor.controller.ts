import { MESSAGES } from '@/constants/messages.constants';
import { UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as vendorService from '@/modules/vendors/vendor.service';
import type {
  CreateVendorInput,
  GetVendorsQuery,
  UpdateVendorCoverInput,
  UpdateVendorInput,
  UpdateVendorLogoInput,
  UpdateVendorStatusInput,
} from '@/modules/vendors/vendor.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

// ─── POST /vendors ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Create a vendor profile (Vendor role only)
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [businessName, address, city, country]
 *             properties:
 *               businessName: { type: string, minLength: 2, maxLength: 100 }
 *               description:  { type: string, maxLength: 1000 }
 *               address:      { type: string, minLength: 5 }
 *               city:         { type: string }
 *               state:        { type: string }
 *               country:      { type: string }
 *               postalCode:   { type: string }
 *               website:      { type: string, format: uri }
 *               socialLinks:
 *                 type: object
 *                 properties:
 *                   facebook:  { type: string, format: uri }
 *                   instagram: { type: string, format: uri }
 *                   twitter:   { type: string, format: uri }
 *                   youtube:   { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Vendor profile created and pending approval
 *       409:
 *         description: Vendor profile already exists
 *       403:
 *         description: Only VENDOR role can create a vendor profile
 */
export const createVendor = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const vendor = await vendorService.createVendor(req.user.id, req.body as CreateVendorInput);
  sendSuccess(res, {
    statusCode: 201,
    message: MESSAGES.VENDOR.PENDING_APPROVAL,
    data: vendor,
  });
});

// ─── GET /vendors/me ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /vendors/me:
 *   get:
 *     summary: Get the authenticated vendor's own profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor profile fetched
 *       404:
 *         description: Vendor profile not found
 */
export const getMyVendorProfile = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const vendor = await vendorService.getMyVendorProfile(req.user.id);
    sendSuccess(res, { message: MESSAGES.VENDOR.FETCHED, data: vendor });
  },
);

// ─── PATCH /vendors/me ────────────────────────────────────────────────────────

/**
 * @swagger
 * /vendors/me:
 *   patch:
 *     summary: Update the authenticated vendor's profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessName: { type: string }
 *               description:  { type: string }
 *               address:      { type: string }
 *               city:         { type: string }
 *               state:        { type: string }
 *               country:      { type: string }
 *               postalCode:   { type: string }
 *               website:      { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Vendor profile updated
 *       400:
 *         description: No fields provided
 */
export const updateMyVendorProfile = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const vendor = await vendorService.updateVendorProfile(
      req.user.id,
      req.body as UpdateVendorInput,
    );
    sendSuccess(res, { message: MESSAGES.VENDOR.UPDATED, data: vendor });
  },
);

// ─── PATCH /vendors/me/logo ───────────────────────────────────────────────────

/**
 * @swagger
 * /vendors/me/logo:
 *   patch:
 *     summary: Update vendor logo URL
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [logoUrl]
 *             properties:
 *               logoUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Logo updated
 */
export const updateVendorLogo = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const vendor = await vendorService.updateVendorLogo(
    req.user.id,
    req.body as UpdateVendorLogoInput,
  );
  sendSuccess(res, { message: 'Vendor logo updated successfully', data: vendor });
});

// ─── PATCH /vendors/me/cover ──────────────────────────────────────────────────

/**
 * @swagger
 * /vendors/me/cover:
 *   patch:
 *     summary: Update vendor cover image URL
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coverImageUrl]
 *             properties:
 *               coverImageUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Cover image updated
 */
export const updateVendorCover = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const vendor = await vendorService.updateVendorCover(
    req.user.id,
    req.body as UpdateVendorCoverInput,
  );
  sendSuccess(res, { message: 'Vendor cover image updated successfully', data: vendor });
});

// ─── GET /vendors ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Get all vendors (approved only for public; all statuses for admin)
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, SUSPENDED] }
 *         description: Admin only — filter by status
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by business name, city, or country
 *     responses:
 *       200:
 *         description: Vendors list fetched
 */
export const getAllVendors = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { vendors, meta } = await vendorService.getAllVendors(
    req,
    req.query as GetVendorsQuery,
    req.user.role,
  );
  sendSuccess(res, { message: MESSAGES.VENDOR.LIST_FETCHED, data: vendors, meta });
});

// ─── GET /vendors/:id ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /vendors/{id}:
 *   get:
 *     summary: Get a vendor by ID
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vendor profile fetched
 *       404:
 *         description: Vendor not found
 */
export const getVendorById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const rawId = req.params['id'];
  const vendorId = Array.isArray(rawId) ? rawId[0] : rawId;
  const vendor = await vendorService.getVendorById(req.user.id, req.user.role, vendorId);
  sendSuccess(res, { message: MESSAGES.VENDOR.FETCHED, data: vendor });
});

// ─── PATCH /vendors/:id/status (Admin Only) ───────────────────────────────────

/**
 * @swagger
 * /vendors/{id}/status:
 *   patch:
 *     summary: Update vendor approval status (Admin only)
 *     tags: [Vendors]
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
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED, SUSPENDED]
 *               rejectionReason:
 *                 type: string
 *                 description: Required when status is REJECTED
 *     responses:
 *       200:
 *         description: Vendor status updated
 *       400:
 *         description: Rejection reason required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 */
export const updateVendorStatus = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const rawId = req.params['id'];
    const vendorId = Array.isArray(rawId) ? rawId[0] : rawId;
    const vendor = await vendorService.updateVendorStatus(
      req.user.id,
      vendorId,
      req.body as UpdateVendorStatusInput,
    );
    sendSuccess(res, { message: 'Vendor status updated successfully', data: vendor });
  },
);
