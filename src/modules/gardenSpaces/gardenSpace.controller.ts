import { type Request, type Response } from 'express';

import { prisma } from '@/config/prisma';
import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { ForbiddenError, UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta, sendSuccess } from '@/utils/response.util';

import * as gardenSpaceService from './gardenSpace.service';
import {
  type CreateGardenSpaceInput,
  type ListGardenSpacesQuery,
  type UpdateGardenSpaceInput,
} from './gardenSpace.types';

// ─── Create Garden Space ──────────────────────────────────────────────────────

/**
 * @swagger
 * /garden-spaces:
 *   post:
 *     summary: Create a new garden space within a farm
 *     description: Approved vendors can create rentable garden plots inside their farms.
 *     tags: [Garden Spaces]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [farmId, name, size, pricePerMonth]
 *             properties:
 *               farmId:        { type: string, description: "ID of the farm this space belongs to" }
 *               name:          { type: string, minLength: 2, maxLength: 100 }
 *               description:   { type: string }
 *               size:          { type: number, description: "Size in square meters" }
 *               pricePerMonth: { type: number, description: "Monthly rental price" }
 *               features:      { type: array, items: { type: string }, example: ["drip irrigation", "shade net"] }
 *               maxCrops:      { type: integer, description: "Maximum number of crops allowed" }
 *     responses:
 *       201:
 *         description: Garden space created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – vendor not approved or does not own the farm
 *       404:
 *         description: Farm not found
 *       422:
 *         description: Validation error
 */
export const createGardenSpace = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const vendorId = await getVendorIdFromUser(req.user.id);
  const space = await gardenSpaceService.createGardenSpace(
    vendorId,
    req.body as CreateGardenSpaceInput,
  );
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.GARDEN_SPACE.CREATED,
    data: space,
  });
});

// ─── List Garden Spaces ───────────────────────────────────────────────────────

/**
 * @swagger
 * /garden-spaces:
 *   get:
 *     summary: List all garden spaces
 *     description: Public endpoint. Supports filtering by farmId, status, price range, size range, and search.
 *     tags: [Garden Spaces]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: farmId
 *         schema: { type: string }
 *         description: Filter spaces belonging to a specific farm
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [AVAILABLE, BOOKED, MAINTENANCE, INACTIVE] }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: minSize
 *         schema: { type: number }
 *       - in: query
 *         name: maxSize
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Garden spaces fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
export const listGardenSpaces = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationOptions(req);
  const query = req.query as ListGardenSpacesQuery;

  const { spaces, total } = await gardenSpaceService.listGardenSpaces(query, pagination);
  sendSuccess(res, {
    message: MESSAGES.GARDEN_SPACE.LIST_FETCHED,
    data: spaces,
    meta: buildMeta(total, pagination.page, pagination.limit),
  });
});

// ─── Get Garden Space By ID ───────────────────────────────────────────────────

/**
 * @swagger
 * /garden-spaces/{id}:
 *   get:
 *     summary: Get a single garden space by ID
 *     description: Returns full details including the parent farm and vendor info.
 *     tags: [Garden Spaces]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Garden space fetched successfully
 *       404:
 *         description: Garden space not found
 */
export const getGardenSpace = asyncHandler(async (req: Request, res: Response) => {
  const space = await gardenSpaceService.getGardenSpaceById(req.params['id'] as string);
  sendSuccess(res, { message: MESSAGES.GARDEN_SPACE.FETCHED, data: space });
});

// ─── Get Spaces By Farm ───────────────────────────────────────────────────────

/**
 * @swagger
 * /garden-spaces/farm/{farmId}:
 *   get:
 *     summary: Get all garden spaces for a specific farm
 *     tags: [Garden Spaces]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: farmId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Garden spaces fetched successfully
 *       404:
 *         description: Farm not found
 */
export const getSpacesByFarm = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationOptions(req);
  const { spaces, total } = await gardenSpaceService.getSpacesByFarm(
    req.params['farmId'] as string,
    pagination,
  );
  sendSuccess(res, {
    message: MESSAGES.GARDEN_SPACE.LIST_FETCHED,
    data: spaces,
    meta: buildMeta(total, pagination.page, pagination.limit),
  });
});

// ─── Update Garden Space ──────────────────────────────────────────────────────

/**
 * @swagger
 * /garden-spaces/{id}:
 *   patch:
 *     summary: Update a garden space
 *     description: |
 *       Only the vendor who owns the parent farm can update a space.
 *       Setting `status` to `BOOKED` is not allowed here — that is managed by the booking system.
 *       Allowed status transitions: `AVAILABLE`, `MAINTENANCE`, `INACTIVE`.
 *     tags: [Garden Spaces]
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
 *             properties:
 *               name:          { type: string }
 *               description:   { type: string }
 *               size:          { type: number }
 *               pricePerMonth: { type: number }
 *               status:        { type: string, enum: [AVAILABLE, MAINTENANCE, INACTIVE] }
 *               features:      { type: array, items: { type: string } }
 *               maxCrops:      { type: integer }
 *     responses:
 *       200:
 *         description: Garden space updated successfully
 *       400:
 *         description: Cannot set status to BOOKED manually
 *       403:
 *         description: Forbidden – not the farm owner
 *       404:
 *         description: Garden space not found
 */
export const updateGardenSpace = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const vendorId = await getVendorIdFromUser(req.user.id);
  const space = await gardenSpaceService.updateGardenSpace(
    req.params['id'] as string,
    vendorId,
    req.body as UpdateGardenSpaceInput,
  );
  sendSuccess(res, { message: MESSAGES.GARDEN_SPACE.UPDATED, data: space });
});

// ─── Delete Garden Space ──────────────────────────────────────────────────────

/**
 * @swagger
 * /garden-spaces/{id}:
 *   delete:
 *     summary: Delete a garden space
 *     description: |
 *       Only the vendor who owns the parent farm can delete a space.
 *       Deletion is blocked if the space has any PENDING, APPROVED, or ACTIVE bookings.
 *     tags: [Garden Spaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Garden space deleted successfully
 *       400:
 *         description: Cannot delete – active bookings exist
 *       403:
 *         description: Forbidden – not the farm owner
 *       404:
 *         description: Garden space not found
 */
export const deleteGardenSpace = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const vendorId = await getVendorIdFromUser(req.user.id);
  await gardenSpaceService.deleteGardenSpace(req.params['id'] as string, vendorId);
  sendSuccess(res, { message: MESSAGES.GARDEN_SPACE.DELETED });
});

// ─── Private helpers ──────────────────────────────────────────────────────────

async function getVendorIdFromUser(userId: string): Promise<string> {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });

  if (!vendor) {
    throw new ForbiddenError('You must have a vendor profile to perform this action');
  }

  if (vendor.status !== 'APPROVED') {
    throw new ForbiddenError('Your vendor account must be approved before managing garden spaces');
  }

  return vendor.id;
}
