import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import type { IAuthenticatedRequest } from '@/interfaces/request.interface';
import type { IApiMeta } from '@/interfaces/response.interface';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import * as certificationService from './certification.service';

import type {
  ListCertificationsQuery,
  ReviewCertificationInput,
  UploadCertificationInput,
} from './certification.types';
import type { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';

// ─── Vendor Controllers ───────────────────────────────────────────────────────

/**
 * @swagger
 * /certifications:
 *   post:
 *     summary: Upload a new certification (Vendor only)
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, issuedBy, issuedAt, documentUrl]
 *             properties:
 *               title:       { type: string }
 *               issuedBy:    { type: string }
 *               certNumber:  { type: string }
 *               issuedAt:    { type: string, format: date }
 *               expiresAt:   { type: string, format: date }
 *               documentUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Certification uploaded and pending review
 *       403:
 *         description: Vendor profile not found or access denied
 */
export const uploadCertification = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const vendor = await import('@/config/prisma').then(({ prisma }) =>
      prisma.vendor.findUnique({ where: { userId: req.user?.id } }),
    );

    const certification = await certificationService.uploadCertification(
      vendor?.id ?? '',
      req.body as UploadCertificationInput,
    );

    sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: MESSAGES.CERTIFICATION.UPLOADED,
      data: certification,
    });
  },
);

/**
 * @swagger
 * /certifications/my:
 *   get:
 *     summary: Get my certifications (Vendor only)
 *     tags: [Certifications]
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
 *         description: List of vendor certifications
 */
export const getMyCertifications = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const vendor = await import('@/config/prisma').then(({ prisma }) =>
      prisma.vendor.findUnique({ where: { userId: req.user?.id } }),
    );

    const { certifications, meta } = await certificationService.getMyCertifications(
      vendor?.id ?? '',
      req as Request,
    );

    sendSuccess(res, {
      message: MESSAGES.CERTIFICATION.LIST_FETCHED,
      data: certifications,
      meta: meta as IApiMeta,
    });
  },
);

/**
 * @swagger
 * /certifications/{id}:
 *   get:
 *     summary: Get a single certification by ID
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Certification details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Certification not found
 */
export const getCertificationById = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const certification = await certificationService.getCertificationById(
      req.params.id as string,
      req.user?.id ?? '',
      req.user?.role as UserRole,
    );

    sendSuccess(res, {
      message: MESSAGES.CERTIFICATION.LIST_FETCHED,
      data: certification,
    });
  },
);

/**
 * @swagger
 * /certifications/{id}:
 *   delete:
 *     summary: Delete a pending certification (Vendor only)
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Certification deleted
 *       400:
 *         description: Can only delete PENDING certifications
 *       403:
 *         description: Access denied
 *       404:
 *         description: Certification not found
 */
export const deleteCertification = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const result = await certificationService.deleteCertification(
      req.params.id as string,
      req.user?.id ?? '',
    );

    sendSuccess(res, { message: result.message });
  },
);

// ─── Admin Controllers ────────────────────────────────────────────────────────

/**
 * @swagger
 * /certifications/admin:
 *   get:
 *     summary: List all certifications (Admin only)
 *     tags: [Certifications]
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
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, EXPIRED] }
 *       - in: query
 *         name: vendorId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of certifications
 */
export const adminListCertifications = asyncHandler(async (req: Request, res: Response) => {
  const { certifications, meta } = await certificationService.adminListCertifications(
    req.query as ListCertificationsQuery,
    req,
  );

  sendSuccess(res, {
    message: MESSAGES.CERTIFICATION.LIST_FETCHED,
    data: certifications,
    meta: meta as IApiMeta,
  });
});

/**
 * @swagger
 * /certifications/admin/{id}/review:
 *   patch:
 *     summary: Approve or reject a certification (Admin only)
 *     tags: [Certifications]
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
 *               status:          { type: string, enum: [APPROVED, REJECTED] }
 *               reviewNotes:     { type: string }
 *               rejectionReason: { type: string }
 *     responses:
 *       200:
 *         description: Certification reviewed
 *       400:
 *         description: Invalid status transition or missing rejection reason
 *       404:
 *         description: Certification not found
 */
export const reviewCertification = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const certification = await certificationService.reviewCertification(
      req.params.id as string,
      req.user?.id ?? '',
      req.body as ReviewCertificationInput,
    );

    const isApproved =
      (req.body as ReviewCertificationInput).status === 'APPROVED'
        ? MESSAGES.CERTIFICATION.APPROVED
        : MESSAGES.CERTIFICATION.REJECTED;

    sendSuccess(res, { message: isApproved, data: certification });
  },
);
