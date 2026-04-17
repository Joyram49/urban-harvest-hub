import { Router } from 'express';

import { authLimiter } from '@/middlewares/rateLimiter.middleware';
import { validate } from '@/middlewares/validate.middleware';
import * as authController from '@/modules/auth/auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@/modules/auth/auth.types';

const router = Router();

// Apply stricter rate limit to all auth routes
router.use(authLimiter);

// ─── Public Routes ────────────────────────────────────────────────────────────

router.post('/register', validate(registerSchema), authController.register);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-otp', authController.resendOtp);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;
