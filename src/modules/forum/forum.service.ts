import { UserRole } from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { socketEmit } from '@/config/socket';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import type { IApiMeta } from '@/interfaces/response.interface';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type {
  AdminModeratePostInput,
  CreateCommentInput,
  CreatePostInput,
  ListPostsQuery,
  ListReportsQuery,
  ReactToPostInput,
  ReportCommentInput,
  ReportPostInput,
  UpdateCommentInput,
  UpdatePostInput,
} from './forum.types';
import type { Request } from 'express';

// ─── Post selector (reusable shape for list/single) ──────────────────────────

const postListSelect = {
  id: true,
  title: true,
  content: true,
  tags: true,
  imageUrl: true,
  images: true,
  isPinned: true,
  isLocked: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
  },
  _count: { select: { comments: true, reactions: true } },
} as const;

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function listPosts(
  query: ListPostsQuery,
  req: Request,
): Promise<{ posts: object[]; meta: IApiMeta }> {
  const { page, limit, skip } = getPaginationOptions(req);

  const where = {
    ...(query.tag && { tags: { has: query.tag } }),
    ...(query.authorId && { authorId: query.authorId }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { content: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      where,
      select: postListSelect,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.forumPost.count({ where }),
  ]);

  return { posts, meta: buildMeta(total, page, limit) };
}

export async function getPostById(postId: string): Promise<object> {
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
      },
      comments: {
        where: { parentId: null }, // top-level only
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      },
      reactions: {
        select: { type: true, userId: true },
      },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  if (!post) throw new NotFoundError('Forum post not found');

  // Increment view count (fire and forget)
  prisma.forumPost
    .update({ where: { id: postId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return post;
}

export async function createPost(authorId: string, input: CreatePostInput): Promise<object> {
  const post = await prisma.forumPost.create({
    data: {
      authorId,
      title: input.title,
      content: input.content,
      tags: input.tags,
      imageUrl: input.imageUrl,
      images: input.images,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  logger.info(`Forum post created: ${post.id} by user ${authorId}`);
  return post;
}

export async function updatePost(
  postId: string,
  requesterId: string,
  requesterRole: UserRole,
  input: UpdatePostInput,
): Promise<object> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  if (requesterRole !== UserRole.ADMIN && post.authorId !== requesterId) {
    throw new ForbiddenError('You can only edit your own posts');
  }
  if (post.isLocked && requesterRole !== UserRole.ADMIN) {
    throw new BadRequestError('This post is locked and cannot be edited');
  }

  const updated = await prisma.forumPost.update({
    where: { id: postId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.images !== undefined && { images: input.images }),
    },
  });

  return updated;
}

export async function deletePost(
  postId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<{ message: string }> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  if (requesterRole !== UserRole.ADMIN && post.authorId !== requesterId) {
    throw new ForbiddenError('You can only delete your own posts');
  }

  await prisma.forumPost.delete({ where: { id: postId } });
  logger.info(`Forum post deleted: ${postId}`);
  return { message: 'Post deleted successfully' };
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function addComment(
  postId: string,
  authorId: string,
  input: CreateCommentInput,
): Promise<object> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');
  if (post.isLocked) throw new BadRequestError('This post is locked. No new comments allowed.');

  // Validate parentId if supplied (must belong to same post)
  if (input.parentId) {
    const parent = await prisma.forumComment.findUnique({ where: { id: input.parentId } });
    if (parent?.postId !== postId) {
      throw new BadRequestError('Invalid parent comment');
    }
    // Only one level of nesting — parent must itself be a top-level comment
    if (parent.parentId) {
      throw new BadRequestError('Replies can only be one level deep');
    }
  }

  const comment = await prisma.forumComment.create({
    data: {
      postId,
      authorId,
      content: input.content,
      parentId: input.parentId,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  // Real-time: notify post room
  socketEmit.toRoom(`forum:post:${postId}`, 'forum:comment:new', {
    postId,
    comment,
  });

  logger.info(`Comment added to post ${postId} by user ${authorId}`);
  return comment;
}

export async function updateComment(
  commentId: string,
  requesterId: string,
  input: UpdateCommentInput,
): Promise<object> {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError('Comment not found');
  if (comment.authorId !== requesterId) {
    throw new ForbiddenError('You can only edit your own comments');
  }

  const updated = await prisma.forumComment.update({
    where: { id: commentId },
    data: { content: input.content },
  });

  return updated;
}

export async function deleteComment(
  commentId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<{ message: string }> {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError('Comment not found');

  if (requesterRole !== UserRole.ADMIN && comment.authorId !== requesterId) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await prisma.forumComment.delete({ where: { id: commentId } });
  return { message: 'Comment deleted successfully' };
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function reactToPost(
  postId: string,
  userId: string,
  input: ReactToPostInput,
): Promise<{ message: string; reaction: object | null }> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  const existing = await prisma.forumReaction.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  // Toggle: same type → remove; different type → update; none → create
  if (existing) {
    if (existing.type === input.type) {
      await prisma.forumReaction.delete({
        where: { postId_userId: { postId, userId } },
      });
      return { message: 'Reaction removed', reaction: null };
    }

    const updated = await prisma.forumReaction.update({
      where: { postId_userId: { postId, userId } },
      data: { type: input.type },
    });
    return { message: 'Reaction updated', reaction: updated };
  }

  const reaction = await prisma.forumReaction.create({
    data: { postId, userId, type: input.type },
  });
  return { message: 'Reaction added', reaction };
}

export async function getPostReactions(postId: string): Promise<object> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  const reactions = await prisma.forumReaction.groupBy({
    by: ['type'],
    where: { postId },
    _count: { type: true },
  });

  const summary = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = r._count.type;
    return acc;
  }, {});

  return { postId, reactions: summary };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function reportPost(
  postId: string,
  reporterId: string,
  input: ReportPostInput,
): Promise<{ message: string }> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');
  if (post.authorId === reporterId) {
    throw new BadRequestError('You cannot report your own post');
  }

  await prisma.forumReport.create({
    data: { reporterId, postId, reason: input.reason, details: input.details },
  });

  // Flag the post
  await prisma.forumPost.update({ where: { id: postId }, data: { isReported: true } });

  logger.info(`Post ${postId} reported by user ${reporterId}`);
  return { message: 'Post reported successfully. Our team will review it.' };
}

export async function reportComment(
  commentId: string,
  reporterId: string,
  input: ReportCommentInput,
): Promise<{ message: string }> {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError('Comment not found');
  if (comment.authorId === reporterId) {
    throw new BadRequestError('You cannot report your own comment');
  }

  await prisma.forumReport.create({
    data: { reporterId, commentId, reason: input.reason, details: input.details },
  });

  await prisma.forumComment.update({ where: { id: commentId }, data: { isReported: true } });

  return { message: 'Comment reported successfully. Our team will review it.' };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminModeratePost(
  postId: string,
  input: AdminModeratePostInput,
): Promise<object> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  const updated = await prisma.forumPost.update({
    where: { id: postId },
    data: {
      ...(input.isPinned !== undefined && { isPinned: input.isPinned }),
      ...(input.isLocked !== undefined && { isLocked: input.isLocked }),
    },
  });

  logger.info(`Post ${postId} moderated by admin: ${JSON.stringify(input)}`);
  return updated;
}

export async function adminDeletePost(postId: string): Promise<{ message: string }> {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Forum post not found');

  await prisma.forumPost.delete({ where: { id: postId } });
  logger.info(`Forum post hard-deleted by admin: ${postId}`);
  return { message: 'Post deleted by admin' };
}

export async function adminDeleteComment(commentId: string): Promise<{ message: string }> {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError('Comment not found');

  await prisma.forumComment.delete({ where: { id: commentId } });
  logger.info(`Forum comment hard-deleted by admin: ${commentId}`);
  return { message: 'Comment deleted by admin' };
}

export async function adminListReports(
  query: ListReportsQuery,
  req: Request,
): Promise<{ reports: object[]; meta: IApiMeta }> {
  const { page, limit, skip } = getPaginationOptions(req);

  const where = {
    ...(query.isResolved !== undefined && { isResolved: query.isResolved }),
  };

  const [reports, total] = await Promise.all([
    prisma.forumReport.findMany({
      where,
      include: {
        post: { select: { id: true, title: true, authorId: true } },
        comment: { select: { id: true, content: true, authorId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.forumReport.count({ where }),
  ]);

  return { reports, meta: buildMeta(total, page, limit) };
}

export async function adminResolveReport(reportId: string, adminId: string): Promise<object> {
  const report = await prisma.forumReport.findUnique({ where: { id: reportId } });
  if (!report) throw new NotFoundError('Report not found');
  if (report.isResolved) throw new BadRequestError('Report is already resolved');

  const updated = await prisma.forumReport.update({
    where: { id: reportId },
    data: { isResolved: true, resolvedBy: adminId, resolvedAt: new Date() },
  });

  logger.info(`Forum report ${reportId} resolved by admin ${adminId}`);
  return updated;
}
