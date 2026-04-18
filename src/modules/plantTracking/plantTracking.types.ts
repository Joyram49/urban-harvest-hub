import { PlantHealthStatus, PlantStage } from '@prisma/client';
import { z } from 'zod';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const createPlantTrackingSchema = z.object({
  body: z.object({
    bookingId: z.string().trim().min(1, 'Booking ID is required'),
    cropName: z.string().trim().min(1, 'Crop name is required').max(100),
    cropVariety: z.string().trim().max(100).optional(),
    plantedAt: z.coerce.date({ error: 'Invalid planted date' }).optional(),
    estimatedHarvest: z.coerce.date({ error: 'Invalid estimated harvest date' }).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const addPlantUpdateSchema = z.object({
  body: z.object({
    stage: z.enum(PlantStage),
    healthStatus: z.enum(PlantHealthStatus),
    notes: z.string().trim().max(1000).optional(),
    imageUrl: z.url('Invalid image URL').optional(),
    images: z.array(z.string().url('Invalid image URL')).max(5).optional(),
    heightCm: z.number().positive().optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Plant tracking ID is required'),
  }),
});

export const updatePlantTrackingSchema = z.object({
  body: z.object({
    cropName: z.string().trim().min(1).max(100).optional(),
    cropVariety: z.string().trim().max(100).optional(),
    stage: z.enum(PlantStage).optional(),
    healthStatus: z.enum(PlantHealthStatus).optional(),
    plantedAt: z.coerce.date().optional(),
    estimatedHarvest: z.coerce.date().optional(),
    actualHarvest: z.coerce.date().optional(),
    totalYieldKg: z.number().positive().optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Plant tracking ID is required'),
  }),
});

export const plantTrackingListQuerySchema = z.object({
  query: z.object({
    stage: z.enum(PlantStage).optional(),
    healthStatus: z.enum(PlantHealthStatus).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreatePlantTrackingInput = z.infer<typeof createPlantTrackingSchema>['body'];
export type AddPlantUpdateInput = z.infer<typeof addPlantUpdateSchema>['body'];
export type UpdatePlantTrackingInput = z.infer<typeof updatePlantTrackingSchema>['body'];
export type PlantTrackingListQuery = z.infer<typeof plantTrackingListQuerySchema>['query'];
