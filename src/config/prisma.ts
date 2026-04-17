import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { env } from './env';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use stdout logging to avoid event typing incompatibilities
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prismaClient = new PrismaClient({
  adapter,
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
});

export const prisma = globalForPrisma.prisma ?? prismaClient;

// ── Prevent multiple instances in dev (Hot Reload fix) ─────────────
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ── Connect DB ────────────────────────────────────────────────────
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// ── Disconnect DB ─────────────────────────────────────────────────
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
