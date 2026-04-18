import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { UnauthorizedError } from '@/errors/AppError';
import type { IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as plantService from '@/modules/plantTracking/plantTracking.service';
import type {
  AddPlantUpdateInput,
  CreatePlantTrackingInput,
  UpdatePlantTrackingInput,
} from '@/modules/plantTracking/plantTracking.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

/**
 * @swagger
 * /plants:
 *   post:
 *     summary: Start plant tracking for a booking (Vendor only)
 *     tags: [Plant Tracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, cropName]
 *             properties:
 *               bookingId:        { type: string }
 *               cropName:         { type: string }
 *               cropVariety:      { type: string }
 *               plantedAt:        { type: string, format: date }
 *               estimatedHarvest: { type: string, format: date }
 *               notes:            { type: string }
 *     responses:
 *       201:
 *         description: Plant tracking created
 *       400:
 *         description: Invalid booking or tracking already exists
 *       403:
 *         description: Access denied
 */
export const createPlantTracking = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const tracking = await plantService.createPlantTracking(
      req.body as CreatePlantTrackingInput,
      req.user.id,
    );
    sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: MESSAGES.PLANT.CREATED,
      data: tracking,
    });
  },
);

/**
 * @swagger
 * /plants:
 *   get:
 *     summary: Get plant trackings (filtered by role)
 *     tags: [Plant Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stage
 *         schema:
 *           type: string
 *           enum: [SEED, GERMINATION, SEEDLING, VEGETATIVE, FLOWERING, FRUITING, HARVEST_READY, HARVESTED]
 *       - in: query
 *         name: healthStatus
 *         schema:
 *           type: string
 *           enum: [EXCELLENT, GOOD, FAIR, POOR, CRITICAL]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: List of plant trackings
 */
export const getPlantTrackings = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await plantService.getPlantTrackings(req, req.user.id, req.user.role);
  sendSuccess(res, {
    message: MESSAGES.PLANT.LIST_FETCHED,
    data: result.data,
    meta: result.meta as Parameters<typeof sendSuccess>[1]['meta'],
  });
});

/**
 * @swagger
 * /plants/{id}:
 *   get:
 *     summary: Get a single plant tracking record
 *     tags: [Plant Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plant tracking details with all updates
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
export const getPlantTrackingById = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const tracking = await plantService.getPlantTrackingById(
      req.params['id'] as string,
      req.user.id,
      req.user.role,
    );
    sendSuccess(res, { message: MESSAGES.PLANT.FETCHED, data: tracking });
  },
);

/**
 * @swagger
 * /plants/{id}:
 *   patch:
 *     summary: Update plant tracking metadata (Vendor only)
 *     tags: [Plant Tracking]
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
 *               cropName:         { type: string }
 *               cropVariety:      { type: string }
 *               estimatedHarvest: { type: string, format: date }
 *               totalYieldKg:     { type: number }
 *               notes:            { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
export const updatePlantTracking = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const updated = await plantService.updatePlantTracking(
      req.params['id'] as string,
      req.body as UpdatePlantTrackingInput,
      req.user.id,
    );
    sendSuccess(res, { message: MESSAGES.PLANT.FETCHED, data: updated });
  },
);

/**
 * @swagger
 * /plants/{id}/updates:
 *   post:
 *     summary: Add a plant growth update (Vendor only)
 *     tags: [Plant Tracking]
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
 *             required: [stage, healthStatus]
 *             properties:
 *               stage:        { type: string, enum: [SEED, GERMINATION, SEEDLING, VEGETATIVE, FLOWERING, FRUITING, HARVEST_READY, HARVESTED] }
 *               healthStatus: { type: string, enum: [EXCELLENT, GOOD, FAIR, POOR, CRITICAL] }
 *               notes:        { type: string }
 *               imageUrl:     { type: string }
 *               images:       { type: array, items: { type: string } }
 *               heightCm:     { type: number }
 *     responses:
 *       201:
 *         description: Plant update added, customer notified
 *       403:
 *         description: Access denied
 */
export const addPlantUpdate = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const update = await plantService.addPlantUpdate(
    req.params['id'] as string,
    req.body as AddPlantUpdateInput,
    req.user.id,
  );
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.PLANT.UPDATE_ADDED,
    data: update,
  });
});
