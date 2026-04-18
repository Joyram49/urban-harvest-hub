import { Router } from 'express';

import { validate } from '@/middlewares/validate.middleware';
import { authenticate, isAdmin } from '@/modules/auth/auth.middleware';

import * as forumController from './forum.controller';
import {
  adminDeleteCommentSchema,
  adminModeratePostSchema,
  adminResolveReportSchema,
  commentParamsSchema,
  createCommentSchema,
  createPostSchema,
  listPostsQuerySchema,
  listReportsQuerySchema,
  postParamsSchema,
  reactToPostSchema,
  reportCommentSchema,
  reportPostSchema,
  updateCommentSchema,
  updatePostSchema,
} from './forum.types';

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

// GET  /forum/posts              — list all posts
router.get('/posts', validate(listPostsQuerySchema), forumController.listPosts);

// GET  /forum/posts/:id          — get single post with comments + reactions
router.get('/posts/:id', validate(postParamsSchema), forumController.getPostById);

// GET  /forum/posts/:id/reactions — reaction summary for a post
router.get('/posts/:id/reactions', validate(postParamsSchema), forumController.getPostReactions);

// ─── Authenticated Routes (any logged-in user) ────────────────────────────────

// POST /forum/posts              — create post
router.post('/posts', authenticate, validate(createPostSchema), forumController.createPost);

// PATCH /forum/posts/:id         — update post (author or admin)
router.patch('/posts/:id', authenticate, validate(updatePostSchema), forumController.updatePost);

// DELETE /forum/posts/:id        — delete post (author or admin)
router.delete('/posts/:id', authenticate, validate(postParamsSchema), forumController.deletePost);

// POST /forum/posts/:id/comments — add comment (supports parentId for replies)
router.post(
  '/posts/:id/comments',
  authenticate,
  validate(createCommentSchema),
  forumController.addComment,
);

// PATCH /forum/comments/:commentId — update comment (author only)
router.patch(
  '/comments/:commentId',
  authenticate,
  validate(updateCommentSchema),
  forumController.updateComment,
);

// DELETE /forum/comments/:commentId — delete comment (author or admin)
router.delete(
  '/comments/:commentId',
  authenticate,
  validate(commentParamsSchema),
  forumController.deleteComment,
);

// POST /forum/posts/:id/reactions — react / toggle reaction
router.post(
  '/posts/:id/reactions',
  authenticate,
  validate(reactToPostSchema),
  forumController.reactToPost,
);

// POST /forum/posts/:id/report   — report a post
router.post(
  '/posts/:id/report',
  authenticate,
  validate(reportPostSchema),
  forumController.reportPost,
);

// POST /forum/comments/:commentId/report — report a comment
router.post(
  '/comments/:commentId/report',
  authenticate,
  validate(reportCommentSchema),
  forumController.reportComment,
);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// PATCH /forum/admin/posts/:id/moderate — pin or lock
router.patch(
  '/admin/posts/:id/moderate',
  authenticate,
  isAdmin,
  validate(adminModeratePostSchema),
  forumController.adminModeratePost,
);

// DELETE /forum/admin/posts/:id — hard delete a post
router.delete(
  '/admin/posts/:id',
  authenticate,
  isAdmin,
  validate(postParamsSchema),
  forumController.adminDeletePost,
);

// DELETE /forum/admin/comments/:commentId — hard delete a comment
router.delete(
  '/admin/comments/:commentId',
  authenticate,
  isAdmin,
  validate(adminDeleteCommentSchema),
  forumController.adminDeleteComment,
);

// GET  /forum/admin/reports      — list all reports
router.get(
  '/admin/reports',
  authenticate,
  isAdmin,
  validate(listReportsQuerySchema),
  forumController.adminListReports,
);

// PATCH /forum/admin/reports/:reportId/resolve — resolve a report
router.patch(
  '/admin/reports/:reportId/resolve',
  authenticate,
  isAdmin,
  validate(adminResolveReportSchema),
  forumController.adminResolveReport,
);

export default router;
