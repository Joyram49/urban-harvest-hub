/* eslint-disable no-nested-ternary */
import { ForumReactionType } from '@prisma/client';
import { z } from 'zod';

// ─── Post Schemas ─────────────────────────────────────────────────────────────

export const createPostSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(5, 'Title must be at least 5 characters')
      .max(300, 'Title must be at most 300 characters'),
    content: z.string().trim().min(10, 'Content must be at least 10 characters'),
    tags: z.array(z.string().trim().min(1).max(50)).max(10, 'Max 10 tags allowed').default([]),
    imageUrl: z.string().trim().url('imageUrl must be a valid URL').optional(),
    images: z.array(z.string().trim().url()).max(10).default([]),
  }),
});

export const updatePostSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Post ID is required'),
  }),
  body: z.object({
    title: z.string().trim().min(5).max(300).optional(),
    content: z.string().trim().min(10).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    imageUrl: z.string().trim().url().nullable().optional(),
    images: z.array(z.string().trim().url()).max(10).optional(),
  }),
});

export const listPostsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    tag: z.string().trim().optional(),
    search: z.string().trim().optional(),
    authorId: z.string().trim().optional(),
  }),
});

// ─── Comment Schemas ──────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Post ID is required'),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, 'Comment cannot be empty')
      .max(2000, 'Comment must be at most 2000 characters'),
    parentId: z.string().trim().optional(), // for nested replies
  }),
});

export const updateCommentSchema = z.object({
  params: z.object({
    commentId: z.string().trim().min(1, 'Comment ID is required'),
  }),
  body: z.object({
    content: z.string().trim().min(1).max(2000),
  }),
});

// ─── Reaction Schema ──────────────────────────────────────────────────────────

export const reactToPostSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Post ID is required'),
  }),
  body: z.object({
    type: z.nativeEnum(ForumReactionType, {
      error: `Reaction type must be one of: ${Object.values(ForumReactionType).join(', ')}`,
    }),
  }),
});

// ─── Report Schemas ───────────────────────────────────────────────────────────

export const reportPostSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Post ID is required'),
  }),
  body: z.object({
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason must be at most 500 characters'),
    details: z.string().trim().max(1000).optional(),
  }),
});

export const reportCommentSchema = z.object({
  params: z.object({
    commentId: z.string().trim().min(1, 'Comment ID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(5).max(500),
    details: z.string().trim().max(1000).optional(),
  }),
});

// ─── Admin Schemas ────────────────────────────────────────────────────────────

export const adminModeratePostSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Post ID is required'),
  }),
  body: z.object({
    isPinned: z.boolean().optional(),
    isLocked: z.boolean().optional(),
  }),
});

export const adminResolveReportSchema = z.object({
  params: z.object({
    reportId: z.string().trim().min(1, 'Report ID is required'),
  }),
});

export const adminDeleteCommentSchema = z.object({
  params: z.object({
    commentId: z.string().trim().min(1, 'Comment ID is required'),
  }),
});

// ─── Shared param schemas ─────────────────────────────────────────────────────

export const postParamsSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Post ID is required'),
  }),
});

export const commentParamsSchema = z.object({
  params: z.object({
    commentId: z.string().trim().min(1, 'Comment ID is required'),
  }),
});

export const listReportsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    isResolved: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreatePostInput = z.infer<typeof createPostSchema>['body'];
export type UpdatePostInput = z.infer<typeof updatePostSchema>['body'];
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>['query'];
export type CreateCommentInput = z.infer<typeof createCommentSchema>['body'];
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>['body'];
export type ReactToPostInput = z.infer<typeof reactToPostSchema>['body'];
export type ReportPostInput = z.infer<typeof reportPostSchema>['body'];
export type ReportCommentInput = z.infer<typeof reportCommentSchema>['body'];
export type AdminModeratePostInput = z.infer<typeof adminModeratePostSchema>['body'];
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>['query'];
