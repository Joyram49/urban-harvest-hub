/* eslint-disable @typescript-eslint/restrict-template-expressions */
import winston from 'winston';

import { env } from '@/config/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp_b, stack_b }) => {
    return stack_b
      ? // eslint-disable-next-line @typescript-eslint/no-base-to-string
        `[${timestamp_b}] ${level}: ${message}\n${stack_b}`
      : `[${timestamp_b}] ${level}: ${message}`;
  }),
);

// JSON format for production
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    // In production, add file transports:
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  silent: env.NODE_ENV === 'test',
});
