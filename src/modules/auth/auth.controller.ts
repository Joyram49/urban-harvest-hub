/* eslint-disable no-nested-ternary */
import { OtpType } from '@prisma/client';

import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { HTTP_STATUS } from '@/constants/http.constants';
import { BadRequestError } from '@/errors/AppError';
import * as authService from '@/modules/auth/auth.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@/modules/auth/auth.types';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { sendSuccess } from '@/utils/response.util';

import { parseDurationToMs } from './auth.utils';

import type { Request, Response } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractRefreshToken(req: Request): string {
  // Accept from cookie (preferred) or request body
  logger.info('From inside the extract');
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const fromCookie =
    (cookies?.refreshToken as string | undefined) ?? (cookies?.refresh_token as string | undefined);
  // const body = req.body as { refreshToken?: string; refresh_token?: string };
  // const fromBody = body.refreshToken ?? body.refresh_token;

  const token = fromCookie;

  if (!token) {
    throw new BadRequestError('Refresh token is required');
  }
  return token;
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: parseDurationToMs('7d'),
    path: '/',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { path: '/' });
}

function getMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  const forwardedFor = req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'];

  return {
    ipAddress:
      typeof forwardedFor === 'string'
        ? forwardedFor
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : req.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email:        { type: string, format: email }
 *               password:     { type: string, minLength: 8 }
 *               firstName:    { type: string }
 *               lastName:     { type: string }
 *               phone:        { type: string }
 *               role:         { type: string, enum: [CUSTOMER, VENDOR] }
 *     responses:
 *       201:
 *         description: Registration successful
 *       409:
 *         description: Email already exists
 *       422:
 *         description: Validation error
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body as RegisterInput);
  sendSuccess(res, { statusCode: HTTP_STATUS.CREATED, message: result.message });
});

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address with OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp:   { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired OTP
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyEmail(req.body as VerifyEmailInput);
  sendSuccess(res, { message: result.message });
});

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP code
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, type]
 *             properties:
 *               email: { type: string, format: email }
 *               type:  { type: string, enum: [EMAIL_VERIFICATION, PASSWORD_RESET] }
 *     responses:
 *       200:
 *         description: OTP sent
 */
export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, type } = req.body as { email?: string; type?: OtpType };
  if (!email || !type) throw new BadRequestError('email and type are required');
  if (!Object.values(OtpType).includes(type)) throw new BadRequestError('Invalid OTP type');

  const result = await authService.resendOtp(email.toLowerCase().trim(), type);
  sendSuccess(res, { message: result.message });
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful, returns user + access token
 *       401:
 *         description: Invalid credentials
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput, getMeta(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  sendSuccess(res, {
    message: 'Login successful',
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
});

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Get new access token using refresh token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: "Optional if using httpOnly cookie" }
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Invalid or expired refresh token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const raw = extractRefreshToken(req);
  const result = await authService.refreshAccessToken(raw, getMeta(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  sendSuccess(res, {
    message: 'Access token refreshed',
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout and revoke refresh token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const raw = extractRefreshToken(req);
  const result = await authService.logout(raw);
  clearRefreshCookie(res);
  sendSuccess(res, { message: result.message });
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset OTP sent (always returns 200 to prevent enumeration)
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body as ForgotPasswordInput);
  sendSuccess(res, { message: result.message });
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword, confirmPassword]
 *             properties:
 *               email:           { type: string, format: email }
 *               otp:             { type: string, minLength: 6, maxLength: 6 }
 *               newPassword:     { type: string, minLength: 8 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired OTP
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetPassword(req.body as ResetPasswordInput);
  sendSuccess(res, { message: result.message });
});
