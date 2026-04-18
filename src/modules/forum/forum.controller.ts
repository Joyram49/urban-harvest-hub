import { HTTP_STATUS } from '@/constants/http.constants';
import { MESSAGES } from '@/constants/messages.constants';
import { BadRequestError } from '@/errors/AppError';
import type { IAuthenticatedRequest } from '@/interfaces/request.interface';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import * as forumService from './forum.service';
import {
  listReportsQuerySchema,
  type AdminModeratePostInput,
  type CreateCommentInput,
  type CreatePostInput,
  type ListPostsQuery,
  type ListReportsQuery,
  type ReactToPostInput,
  type ReportCommentInput,
  type ReportPostInput,
  type UpdateCommentInput,
  type UpdatePostInput,
} from './forum.types';

import type { UserRole } from '@prisma/client';
import type { Response } from 'express';

// ─── Post Controllers ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /forum/posts:
 *   get:
 *     summary: List all forum posts (paginated)
 *     tags: [Forum]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *         description: Filter by tag
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search in title and content
 *       - in: query
 *         name: authorId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of forum posts
 */
export const listPosts = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const { posts, meta } = await forumService.listPosts(req.query as ListPostsQuery, req);
  sendSuccess(res, {
    message: MESSAGES.FORUM.POSTS_FETCHED,
    data: posts,
    meta,
  });
});

/**
 * @swagger
 * /forum/posts/{id}:
 *   get:
 *     summary: Get a single forum post with comments and reactions
 *     tags: [Forum]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Forum post details
 *       404:
 *         description: Post not found
 */
export const getPostById = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const post = await forumService.getPostById(req.params.id as string);
  sendSuccess(res, { message: MESSAGES.FORUM.POST_FETCHED, data: post });
});

/**
 * @swagger
 * /forum/posts:
 *   post:
 *     summary: Create a new forum post
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:    { type: string, minLength: 5, maxLength: 300 }
 *               content:  { type: string, minLength: 10 }
 *               tags:     { type: array, items: { type: string }, maxItems: 10 }
 *               imageUrl: { type: string, format: uri }
 *               images:   { type: array, items: { type: string, format: uri } }
 *     responses:
 *       201:
 *         description: Forum post created
 */
export const createPost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const post = await forumService.createPost(req.user?.id ?? '', req.body as CreatePostInput);
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.FORUM.POST_CREATED,
    data: post,
  });
});

/**
 * @swagger
 * /forum/posts/{id}:
 *   patch:
 *     summary: Update a forum post (author or admin)
 *     tags: [Forum]
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
 *               title:    { type: string }
 *               content:  { type: string }
 *               tags:     { type: array, items: { type: string } }
 *               imageUrl: { type: string, nullable: true }
 *               images:   { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Post updated
 *       403:
 *         description: Not the author
 *       404:
 *         description: Post not found
 */
export const updatePost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const post = await forumService.updatePost(
    req.params.id as string,
    req.user?.id ?? '',
    req.user?.role as UserRole,
    req.body as UpdatePostInput,
  );
  sendSuccess(res, { message: 'Post updated successfully', data: post });
});

/**
 * @swagger
 * /forum/posts/{id}:
 *   delete:
 *     summary: Delete a forum post (author or admin)
 *     tags: [Forum]
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
 *       403:
 *         description: Not the author
 */
export const deletePost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await forumService.deletePost(
    req.params.id as string,
    req.user?.id ?? '',
    req.user?.role as UserRole,
  );
  sendSuccess(res, { message: result.message });
});

// ─── Comment Controllers ──────────────────────────────────────────────────────

/**
 * @swagger
 * /forum/posts/{id}/comments:
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Forum]
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
 *             required: [content]
 *             properties:
 *               content:  { type: string, maxLength: 2000 }
 *               parentId: { type: string, description: "Reply to a specific comment" }
 *     responses:
 *       201:
 *         description: Comment added
 *       400:
 *         description: Post is locked or invalid parentId
 */
export const addComment = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const comment = await forumService.addComment(
    req.params.id as string,
    req.user?.id ?? '',
    req.body as CreateCommentInput,
  );
  sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.FORUM.COMMENT_ADDED,
    data: comment,
  });
});

/**
 * @swagger
 * /forum/comments/{commentId}:
 *   patch:
 *     summary: Update a comment (author only)
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Comment updated
 */
export const updateComment = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const comment = await forumService.updateComment(
    req.params.commentId as string,
    req.user?.id ?? '',
    req.body as UpdateCommentInput,
  );
  sendSuccess(res, { message: 'Comment updated successfully', data: comment });
});

/**
 * @swagger
 * /forum/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (author or admin)
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comment deleted
 */
export const deleteComment = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await forumService.deleteComment(
    req.params.commentId as string,
    req.user?.id ?? '',
    req.user?.role as UserRole,
  );
  sendSuccess(res, { message: result.message });
});

// ─── Reaction Controllers ─────────────────────────────────────────────────────

/**
 * @swagger
 * /forum/posts/{id}/reactions:
 *   post:
 *     summary: React to a post (toggle — same type removes, different type updates)
 *     tags: [Forum]
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
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [LIKE, LOVE, SEEDLING, FIRE, INSIGHTFUL]
 *     responses:
 *       200:
 *         description: Reaction added, updated, or removed
 */
export const reactToPost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await forumService.reactToPost(
    req.params.id as string,
    req.user?.id ?? '',
    req.body as ReactToPostInput,
  );
  sendSuccess(res, { message: result.message, data: result.reaction });
});

/**
 * @swagger
 * /forum/posts/{id}/reactions:
 *   get:
 *     summary: Get reaction summary for a post
 *     tags: [Forum]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reaction counts by type
 */
export const getPostReactions = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const reactions = await forumService.getPostReactions(req.params.id as string);
  sendSuccess(res, { message: 'Reactions fetched', data: reactions });
});

// ─── Report Controllers ───────────────────────────────────────────────────────

/**
 * @swagger
 * /forum/posts/{id}/report:
 *   post:
 *     summary: Report a forum post
 *     tags: [Forum]
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
 *             required: [reason]
 *             properties:
 *               reason:  { type: string, maxLength: 500 }
 *               details: { type: string, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Post reported
 */
export const reportPost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await forumService.reportPost(
    req.params.id as string,
    req.user?.id ?? '',
    req.body as ReportPostInput,
  );
  sendSuccess(res, { message: result.message });
});

/**
 * @swagger
 * /forum/comments/{commentId}/report:
 *   post:
 *     summary: Report a forum comment
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:  { type: string }
 *               details: { type: string }
 *     responses:
 *       200:
 *         description: Comment reported
 */
export const reportComment = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await forumService.reportComment(
    req.params.commentId as string,
    req.user?.id ?? '',
    req.body as ReportCommentInput,
  );
  sendSuccess(res, { message: result.message });
});

// ─── Admin Controllers ────────────────────────────────────────────────────────

/**
 * @swagger
 * /forum/admin/posts/{id}/moderate:
 *   patch:
 *     summary: Pin or lock a post (Admin only)
 *     tags: [Forum]
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
 *               isPinned: { type: boolean }
 *               isLocked: { type: boolean }
 *     responses:
 *       200:
 *         description: Post moderated
 */
export const adminModeratePost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const post = await forumService.adminModeratePost(
    req.params.id as string,
    req.body as AdminModeratePostInput,
  );
  sendSuccess(res, { message: 'Post moderation updated', data: post });
});

/**
 * @swagger
 * /forum/admin/posts/{id}:
 *   delete:
 *     summary: Hard delete a post (Admin only)
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post deleted by admin
 */
export const adminDeletePost = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const result = await forumService.adminDeletePost(req.params.id as string);
  sendSuccess(res, { message: result.message });
});

/**
 * @swagger
 * /forum/admin/comments/{commentId}:
 *   delete:
 *     summary: Hard delete a comment (Admin only)
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comment deleted by admin
 */
export const adminDeleteComment = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const result = await forumService.adminDeleteComment(req.params.commentId as string);
    sendSuccess(res, { message: result.message });
  },
);

/**
 * @swagger
 * /forum/admin/reports:
 *   get:
 *     summary: List all forum reports (Admin only)
 *     tags: [Forum]
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
 *         name: isResolved
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated list of reports
 */
export const adminListReports = asyncHandler(async (req: IAuthenticatedRequest, res: Response) => {
  const querySchema = listReportsQuerySchema.shape.query;

  const result = querySchema.safeParse(req.query as unknown);

  if (!result.success) {
    throw new BadRequestError('Invalid query parameters');
  }

  const parsedQuery: ListReportsQuery = result.data;

  const { reports, meta } = await forumService.adminListReports(parsedQuery, req);

  sendSuccess(res, {
    message: 'Reports fetched',
    data: reports,
    meta,
  });
});

/**
 * @swagger
 * /forum/admin/reports/{reportId}/resolve:
 *   patch:
 *     summary: Mark a report as resolved (Admin only)
 *     tags: [Forum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report resolved
 *       400:
 *         description: Report already resolved
 */
export const adminResolveReport = asyncHandler(
  async (req: IAuthenticatedRequest, res: Response) => {
    const report = await forumService.adminResolveReport(
      req.params.reportId as string,
      req.user?.id ?? '',
    );
    sendSuccess(res, { message: 'Report resolved successfully', data: report });
  },
);
