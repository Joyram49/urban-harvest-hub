import nodemailer from 'nodemailer';

import { env } from './env';
import { logger } from './logger';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false, // true only if using port 465
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },

  // optional pool settings
  pool: true,
  maxConnections: 5,
  maxMessages: 1000,
});

export async function verifyEmailConnection(): Promise<void> {
  if (env.NODE_ENV === 'test') return;

  try {
    await transporter.verify();
    logger.info('Email (SMTP) transport ready');
  } catch (error) {
    logger.error('Email transport failed:', error);
  }
}

export interface IEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const defaultMailOptions = {
  from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>`,
} as const;

export interface IEmailJobData {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string | number | boolean>;
}
