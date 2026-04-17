import crypto from 'crypto';

import { type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '@/config/env';
import { type IJwtPayload, type ITokenPair } from '@/modules/auth/auth.types';

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export function generateAccessToken(payload: Omit<IJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: Omit<IJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): IJwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as IJwtPayload;
}

export function verifyRefreshToken(token: string): IJwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as IJwtPayload;
}

export function generateTokenPair(userId: string, email: string, role: UserRole): ITokenPair {
  const payload: Omit<IJwtPayload, 'iat' | 'exp'> = { sub: userId, email, role };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/** Parse "15m" / "7d" strings into seconds for DB expiry calculation */
export function parseDurationToMs(duration: string): number {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1));
  const map: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (map[unit] ?? 60000);
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

/** Generate a random 6-digit numeric OTP */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Hash an OTP before storing (SHA-256, no salt needed — short-lived) */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function compareOtp(plain: string, hashed: string): boolean {
  return hashOtp(plain) === hashed;
}

// ─── Refresh Token hashing ────────────────────────────────────────────────────

/** Hash the raw refresh token before storing in DB */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
