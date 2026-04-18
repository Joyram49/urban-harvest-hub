import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { type IAuthenticatedRequest } from '@/interfaces/request.interface';
import * as adminService from '@/modules/admin/admin.service';
import type {
  ListCertificationsQuery,
  ListUsersQuery,
  ListVendorsQuery,
  ReviewCertificationInput,
  UpdateUserStatusInput,
  UpdateVendorStatusInput,
} from '@/modules/admin/admin.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import type { Response } from 'express';

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get platform dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved
 *       403:
 *         description: Admin access required
 */
export const getDashboard = asyncHandler(async (_req: IAuthenticatedRequest, res: Response) => {
  const data = await adminService.getDashboardStats();
  sendSuccess(res, { message: 'Dashboard stats retrieved', data });
});

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [ADMIN, VENDOR, CUSTOMER] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, UNVERIFIED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Users retrieved
 */
export const listUsers = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { data, meta } = await adminService.listUsers(req.query as ListUsersQuery, req);
  sendSuccess(res, { message: 'Users retrieved successfully', data, meta });
});

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get a single user by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User retrieved
 *       404:
 *         description: User not found
 */
export const getUserById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const data = await adminService.getUserById(req.params['id'] as string);
  sendSuccess(res, { message: 'User retrieved successfully', data });
});

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Activate or suspend a user
 *     tags: [Admin]
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
 *               status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: User status updated
 *       403:
 *         description: Cannot change own status or suspend another admin
 *       404:
 *         description: User not found
 */
export const updateUserStatus = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const data = await adminService.updateUserStatus(
    req.params['id'] as string,
    req.body as UpdateUserStatusInput,
    req.user?.id as string,
  );
  sendSuccess(res, { message: 'User status updated successfully', data });
});

// ─── Vendors ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/vendors:
 *   get:
 *     summary: List all vendors with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, SUSPENDED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vendors retrieved
 */
export const listVendors = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { data, meta } = await adminService.listVendors(req.query as ListVendorsQuery, req);
  sendSuccess(res, { message: MESSAGES.VENDOR.LIST_FETCHED, data, meta });
});

/**
 * @swagger
 * /admin/vendors/{id}:
 *   get:
 *     summary: Get a single vendor by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vendor retrieved
 *       404:
 *         description: Vendor not found
 */
export const getVendorById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const data = await adminService.getVendorById(req.params['id'] as string);
  sendSuccess(res, { message: MESSAGES.VENDOR.FETCHED, data });
});

/**
 * @swagger
 * /admin/vendors/{id}/status:
 *   patch:
 *     summary: Approve, reject, or suspend a vendor
 *     tags: [Admin]
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
 *               status: { type: string, enum: [APPROVED, REJECTED, SUSPENDED] }
 *               rejectionReason: { type: string }
 *     responses:
 *       200:
 *         description: Vendor status updated
 *       404:
 *         description: Vendor not found
 */
export const updateVendorStatus = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const data = await adminService.updateVendorStatus(
      req.params['id'] as string,
      req.body as UpdateVendorStatusInput,
      req.user?.id as string,
    );
    sendSuccess(res, { message: 'Vendor status updated successfully', data });
  },
);

// ─── Certifications ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/certifications:
 *   get:
 *     summary: List all certifications
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, EXPIRED] }
 *     responses:
 *       200:
 *         description: Certifications retrieved
 */
export const listCertifications = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const { data, meta } = await adminService.listCertifications(
      req.query as ListCertificationsQuery,
      req,
    );
    sendSuccess(res, { message: MESSAGES.CERTIFICATION.LIST_FETCHED, data, meta });
  },
);

/**
 * @swagger
 * /admin/certifications/{id}:
 *   get:
 *     summary: Get a single certification by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Certification retrieved
 *       404:
 *         description: Certification not found
 */
export const getCertificationById = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const data = await adminService.getCertificationById(req.params['id'] as string);
    sendSuccess(res, { message: 'Certification retrieved successfully', data });
  },
);

/**
 * @swagger
 * /admin/certifications/{id}/review:
 *   patch:
 *     summary: Approve or reject a certification
 *     tags: [Admin]
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
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               reviewNotes: { type: string }
 *               rejectionReason: { type: string }
 *     responses:
 *       200:
 *         description: Certification reviewed
 *       404:
 *         description: Certification not found
 */
export const reviewCertification = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const data = await adminService.reviewCertification(
      req.params['id'] as string,
      req.body as ReviewCertificationInput,
      req.user?.id as string,
    );
    sendSuccess(res, { message: 'Certification reviewed successfully', data });
  },
);

// ─── Forum Moderation ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/forum/reports:
 *   get:
 *     summary: List unresolved forum reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Forum reports retrieved
 */
export const listForumReports = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { data, meta } = await adminService.listForumReports(req);
  sendSuccess(res, { message: 'Forum reports retrieved successfully', data, meta });
});

/**
 * @swagger
 * /admin/forum/reports/{id}/resolve:
 *   patch:
 *     summary: Mark a forum report as resolved
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report resolved
 *       404:
 *         description: Report not found
 */
export const resolveForumReport = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const data = await adminService.resolveForumReport(
      req.params['id'] as string,
      req.user?.id as string,
    );
    sendSuccess(res, { message: 'Forum report resolved successfully', data });
  },
);

/**
 * @swagger
 * /admin/forum/posts/{id}:
 *   delete:
 *     summary: Delete a forum post
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post deleted
 *       404:
 *         description: Post not found
 */
export const deleteForumPost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  await adminService.deleteForumPost(req.params['id'] as string, req.user?.id as string);
  sendSuccess(res, { statusCode: HTTP_STATUS.OK, message: 'Forum post deleted successfully' });
});

/**
 * @swagger
 * /admin/forum/posts/{id}/pin:
 *   patch:
 *     summary: Pin or unpin a forum post
 *     tags: [Admin]
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
 *             required: [isPinned]
 *             properties:
 *               isPinned: { type: boolean }
 *     responses:
 *       200:
 *         description: Post pin status updated
 */
export const pinForumPost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { isPinned } = req.body as { isPinned: boolean };
  const data = await adminService.pinForumPost(
    req.params['id'] as string,
    Boolean(isPinned),
    req.user?.id as string,
  );
  sendSuccess(res, {
    message: `Forum post ${isPinned ? 'pinned' : 'unpinned'} successfully`,
    data,
  });
});

/**
 * @swagger
 * /admin/forum/posts/{id}/lock:
 *   patch:
 *     summary: Lock or unlock a forum post
 *     tags: [Admin]
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
 *             required: [isLocked]
 *             properties:
 *               isLocked: { type: boolean }
 *     responses:
 *       200:
 *         description: Post lock status updated
 */
export const lockForumPost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { isLocked } = req.body as { isLocked: boolean };
  const data = await adminService.lockForumPost(
    req.params['id'] as string,
    Boolean(isLocked),
    req.user?.id as string,
  );
  sendSuccess(res, {
    message: `Forum post ${isLocked ? 'locked' : 'unlocked'} successfully`,
    data,
  });
});
