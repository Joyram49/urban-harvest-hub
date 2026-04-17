import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid URL').optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Rate Limit
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1, { error: 'cloud name is required' }),
  CLOUDINARY_API_KEY: z.string().trim().min(1, { error: 'cloud api key is required' }),
  CLOUDINARY_API_SECRET: z.string().trim().min(1, { error: 'cloud secret key is required' }),

  // SMTP
  SMTP_HOST: z.string().trim().min(1, { error: 'smtp host is required' }),
  SMTP_PORT: z.coerce.number().min(1, { error: 'smtp number is required' }),
  SMTP_USER: z.string().trim().min(1, { error: 'smtp user is required' }),
  SMTP_PASS: z.string().trim().min(1, { error: 'smtp pass is required' }),
  SMTP_FROM: z.string().trim().min(1, { error: 'smtp from is required' }),
  MAIL_FROM_NAME: z.string().default('Urban Harvest Hub'),
  MAIL_FROM_ADDRESS: z.email().default('joyram2015@gmail.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
