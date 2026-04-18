import { type Request, type Response } from 'express';

import { prisma } from '@/config/prisma';
import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { ForbiddenError, UnauthorizedError } from '@/errors/AppError';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta, sendSuccess } from '@/utils/response.util';

import * as farmService from './farm.service';
import { type CreateFarmInput, type ListFarmsQuery, type UpdateFarmInput } from './farm.types';

// ─── Create Farm ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /farms:
 *   post:
 *     summary: Create a new farm
 *     description: Vendors can create a farm profile. Requires an approved vendor account.
 *     tags: [Farms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address, city, country]
 *             properties:
 *               name:        { type: string, minLength: 2, maxLength: 100 }
 *               description: { type: string }
 *               address:     { type: string }
 *               city:        { type: string }
 *               state:       { type: string }
 *               country:     { type: string }
 *               postalCode:  { type: string }
 *               latitude:    { type: number }
 *               longitude:   { type: number }
 *               totalArea:   { type: number, description: "In square meters" }
 *               soilType:    { type: string }
 *               waterSource: { type: string }
 *               isOrganic:   { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Farm created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – vendor account required
 *       422:
 *         description: Validation error
 */
export const createFarm = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const vendorId = await getVendorIdFromUser(req.user.id);
  const farm = await farmService.createFarm(vendorId, req.body as CreateFarmInput);
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.FARM.CREATED,
    data: farm,
  });
});

// ─── Get All Farms ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /farms:
 *   get:
 *     summary: List all farms
 *     description: Public endpoint. Supports filtering by city, country, isOrganic and text search.
 *     tags: [Farms]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *       - in: query
 *         name: isOrganic
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: vendorId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Farms fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
export const listFarms = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationOptions(req);
  const query = req.query as ListFarmsQuery;

  const { farms, total } = await farmService.listFarms(query, pagination);
  sendSuccess(res, {
    message: MESSAGES.FARM.LIST_FETCHED,
    data: farms,
    meta: buildMeta(total, pagination.page, pagination.limit),
  });
});

// ─── Get Farm By ID ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /farms/{id}:
 *   get:
 *     summary: Get a farm by ID
 *     tags: [Farms]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Farm fetched successfully
 *       404:
 *         description: Farm not found
 */
export const getFarm = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.getFarmById(req.params['id'] as string);
  sendSuccess(res, { message: MESSAGES.FARM.FETCHED, data: farm });
});

// ─── Update Farm ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /farms/{id}:
 *   patch:
 *     summary: Update a farm
 *     description: Only the vendor who owns the farm can update it.
 *     tags: [Farms]
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
 *               name:        { type: string }
 *               description: { type: string }
 *               address:     { type: string }
 *               city:        { type: string }
 *               state:       { type: string }
 *               country:     { type: string }
 *               postalCode:  { type: string }
 *               latitude:    { type: number }
 *               longitude:   { type: number }
 *               totalArea:   { type: number }
 *               soilType:    { type: string }
 *               waterSource: { type: string }
 *               isOrganic:   { type: boolean }
 *     responses:
 *       200:
 *         description: Farm updated successfully
 *       403:
 *         description: Forbidden – not the farm owner
 *       404:
 *         description: Farm not found
 */
export const updateFarm = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const vendorId = await getVendorIdFromUser(req.user.id);
  const farm = await farmService.updateFarm(
    req.params['id'] as string,
    vendorId,
    req.body as UpdateFarmInput,
  );
  sendSuccess(res, { message: MESSAGES.FARM.UPDATED, data: farm });
});

// ─── Delete Farm ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /farms/{id}:
 *   delete:
 *     summary: Delete a farm
 *     description: Only the vendor who owns the farm can delete it. Cascades to garden spaces.
 *     tags: [Farms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Farm deleted successfully
 *       403:
 *         description: Forbidden – not the farm owner
 *       404:
 *         description: Farm not found
 */
export const deleteFarm = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const vendorId = await getVendorIdFromUser(req.user.id);
  await farmService.deleteFarm(req.params['id'] as string, vendorId);
  sendSuccess(res, { message: MESSAGES.FARM.DELETED });
});

// ─── Get My Farms (vendor's own farms) ───────────────────────────────────────

/**
 * @swagger
 * /farms/my-farms:
 *   get:
 *     summary: Get all farms belonging to the authenticated vendor
 *     tags: [Farms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Farms fetched successfully
 *       403:
 *         description: Vendor account required
 */
export const getMyFarms = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const pagination = getPaginationOptions(req);
  const vendorId = await getVendorIdFromUser(req.user.id);

  const { farms, total } = await farmService.getFarmsByVendor(vendorId, pagination);
  sendSuccess(res, {
    message: MESSAGES.FARM.LIST_FETCHED,
    data: farms,
    meta: buildMeta(total, pagination.page, pagination.limit),
  });
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
    throw new ForbiddenError('Your vendor account must be approved before managing farms');
  }

  return vendor.id;
}
