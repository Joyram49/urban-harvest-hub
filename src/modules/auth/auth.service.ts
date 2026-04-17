import { OtpType, UserStatus, type UserRole } from '@prisma/client';

import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { redis } from '@/config/redis';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '@/errors/AppError';
import {
  type ForgotPasswordInput,
  type IAuthResponse,
  type IAuthUserPayload,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from '@/modules/auth/auth.types';
import {
  compareOtp,
  comparePassword,
  generateOtp,
  generateTokenPair,
  hashOtp,
  hashPassword,
  hashToken,
  parseDurationToMs,
  verifyRefreshToken,
} from '@/modules/auth/auth.utils';

import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './email.service';

// ─── Redis key helpers ────────────────────────────────────────────────────────
const REDIS_KEYS = {
  refreshTokenBlacklist: (token: string) => `blacklist:rt:${token}`,
  otpRateLimit: (email: string, type: string) => `otp:limit:${type}:${email}`,
};

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<{ message: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const hashed = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: input.role,
      status: UserStatus.UNVERIFIED,
    },
  });
  // generate otp
  const result = await issueOtp(user.id, user.email, OtpType.EMAIL_VERIFICATION);

  // send verification mail (using otp)
  await sendVerificationEmail(user.email, user.firstName, result.otp);

  logger.info(`New user registered: ${user.email} [${user.role}]`);
  return { message: 'Registration successful. Please check your email for a verification code.' };
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(input: VerifyEmailInput): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new NotFoundError('User not found');
  if (user.status === UserStatus.ACTIVE) {
    throw new BadRequestError('Email is already verified');
  }

  await consumeOtp(user.id, input.otp, OtpType.EMAIL_VERIFICATION);

  await prisma.user.update({
    where: { id: user.id },
    data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
  });

  logger.info(`Email verified: ${user.email}`);
  return { message: 'Email verified successfully. You can now log in.' };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(
  input: LoginInput,
  meta: { ipAddress?: string; userAgent?: string },
): Promise<IAuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Use same error for wrong email or wrong password (prevent user enumeration)
  if (!user || !(await comparePassword(input.password, user.password))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status === UserStatus.UNVERIFIED) {
    throw new UnauthorizedError('Please verify your email before logging in');
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new UnauthorizedError('Your account has been suspended. Please contact support.');
  }

  const tokens = generateTokenPair(user.id, user.email, user.role);

  // Store hashed refresh token in DB
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashToken(tokens.refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info(`User logged in: ${user.email}`);

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  rawToken: string,
  meta: { ipAddress?: string; userAgent?: string },
): Promise<IAuthResponse> {
  // Check blacklist first
  const isBlacklisted = await redis.exists(REDIS_KEYS.refreshTokenBlacklist(rawToken));
  if (isBlacklisted) throw new UnauthorizedError('Token has been revoked');

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const hashed = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashed } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (user?.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError('User account is not active');
  }

  // Rotate: revoke old token, issue new pair
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // Blacklist old token in Redis for the remainder of its TTL
  const ttlSeconds = Math.max(0, Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000));
  if (ttlSeconds > 0) {
    await redis.set(REDIS_KEYS.refreshTokenBlacklist(rawToken), '1', ttlSeconds);
  }

  const tokens = generateTokenPair(user.id, user.email, user.role);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashToken(tokens.refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  return { user: sanitizeUser(user), tokens };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(rawToken: string): Promise<{ message: string }> {
  const hashed = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashed } });

  if (stored && !stored.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const ttlSeconds = Math.max(0, Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000));
    if (ttlSeconds > 0) {
      await redis.set(REDIS_KEYS.refreshTokenBlacklist(rawToken), '1', ttlSeconds);
    }
  }

  return { message: 'Logged out successfully' };
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Always return the same message — don't leak whether email exists
  const genericMessage =
    'If an account with that email exists, a password reset code has been sent.';

  if (!user || user.status === UserStatus.SUSPENDED) return { message: genericMessage };

  // Rate limit: max 3 OTP requests per 15 min per email
  const limitKey = REDIS_KEYS.otpRateLimit(input.email, 'PASSWORD_RESET');
  const count = await redis.get(limitKey);
  if (count && parseInt(count) >= 3) {
    throw new BadRequestError('Too many reset attempts. Please wait 15 minutes and try again.');
  }

  const result = await issueOtp(user.id, user.email, OtpType.PASSWORD_RESET);

  logger.info({ result });
  // Increment rate limit counter
  const currentCount = count ? parseInt(count) + 1 : 1;
  await redis.set(limitKey, String(currentCount), 15 * 60);

  await sendPasswordResetEmail(user.email, user.firstName, result.otp);
  logger.info(`Password reset OTP issued: ${user.email}`);
  return { message: genericMessage };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new BadRequestError('Invalid request');

  await consumeOtp(user.id, input.otp, OtpType.PASSWORD_RESET);

  const hashed = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  // Revoke all existing refresh tokens for this user (force re-login everywhere)
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await sendPasswordChangedEmail(user.email, user.firstName);

  logger.info(`Password reset: ${user.email}`);
  return { message: 'Password reset successfully. Please log in with your new password.' };
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────

export async function resendOtp(email: string, type: OtpType): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email } });

  const genericMsg = 'If an account with that email exists, a new code has been sent.';
  if (!user) return { message: genericMsg };

  if (type === OtpType.EMAIL_VERIFICATION && user.status === UserStatus.ACTIVE) {
    throw new BadRequestError('Email is already verified');
  }

  const limitKey = REDIS_KEYS.otpRateLimit(email, type);
  const count = await redis.get(limitKey);
  if (count && parseInt(count) >= 5) {
    throw new BadRequestError('Too many requests. Please wait before requesting a new code.');
  }

  await issueOtp(user.id, user.email, type);

  const currentCount = count ? parseInt(count) + 1 : 1;
  await redis.set(limitKey, String(currentCount), 15 * 60);

  return { message: genericMsg };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Create a new OTP record (invalidates any prior pending OTPs of same type) */
async function issueOtp(userId: string, email: string, type: OtpType): Promise<{ otp: string }> {
  // Invalidate any existing unused OTPs of same type
  await prisma.otpCode.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = generateOtp();
  const hashed = hashOtp(otp);

  await prisma.otpCode.create({
    data: {
      userId,
      code: hashed,
      type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  // For now log in development only
  if (env.NODE_ENV === 'development') {
    logger.debug(`OTP [${type}] for ${email}: ${otp}`);
  }
  return { otp };
}

/** Find, verify, and mark an OTP as used */
async function consumeOtp(userId: string, plainOtp: string, type: OtpType): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where: {
      userId,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new BadRequestError('Invalid or expired verification code');
  }

  // Brute-force guard: max 5 wrong attempts
  if (record.attempts >= 5) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    throw new BadRequestError('Too many incorrect attempts. Please request a new code.');
  }

  if (!compareOtp(plainOtp, record.code)) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    const remaining = 4 - record.attempts;
    throw new BadRequestError(
      `Invalid code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code has been locked.'}`,
    );
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
}

/** Strip sensitive fields from user for response */
function sanitizeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl: string | null;
}): IAuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}
