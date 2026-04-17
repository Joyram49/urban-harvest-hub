/* eslint-disable security/detect-non-literal-regexp */
/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs';
import path from 'path';

import { type IEmailJobData, defaultMailOptions, transporter } from '@/config/email';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * Load and populate an HTML email template
 */

function loadTemplate(
  templateName: string,
  variables: Record<string, string | number | boolean>,
): string {
  const basePath =
    process.env['NODE_ENV'] === 'production'
      ? path.join(process.cwd(), 'dist')
      : path.join(process.cwd(), 'src');
  const templatePath = path.join(basePath, 'templates', 'emails', `${templateName}.html`);

  let html = fs.readFileSync(templatePath, 'utf-8');

  // Replace all {{VARIABLE}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, String(value));
  });

  // Replace common globals
  html = html.replace(/{{APP_NAME}}/g, 'Urban Harvest Hub');
  html = html.replace(/{{OTP_CODE}}/g, variables.otp as string);
  html = html.replace(/{{APP_URL}}/g, env.FRONTEND_URL);
  html = html.replace(/{{SUPPORT_EMAIL}}/g, env.MAIL_FROM_ADDRESS);
  html = html.replace(/{{YEAR}}/g, new Date().getFullYear().toString());

  return html;
}

/**
 * Core send function
 */
export async function sendEmail(data: IEmailJobData): Promise<void> {
  try {
    const html = loadTemplate(data.template, data.variables);

    await transporter.sendMail({
      ...defaultMailOptions,
      to: data.to,
      subject: data.subject,
      html,
    });

    logger.info(`Email sent: "${data.subject}" → ${data.to}`);
  } catch (error) {
    logger.error(`Failed to send email to ${data.to}:`, error);
    throw error;
  }
}

// ── Specific email senders ─────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  firstName: string,
  otp: string,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '✅ Verify your Urban Harvest Hub email address',
    template: 'verify-email',
    variables: { FIRST_NAME: firstName, otp },
  });
}

export async function sendOrgVerificationEmail(
  email: string,
  companyName: string,
  otp: string,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '✅ Verify your Urban Harvest Hub organization email',
    template: 'verify-email-vendor',
    variables: { COMPANY_NAME: companyName, otp },
  });
}

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  otp: string,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '🔑 Reset your Urban Harvest Hub password',
    template: 'reset-password',
    variables: { FIRST_NAME: firstName, otp },
  });
}

export async function sendPasswordChangedEmail(email: string, firstName: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: '🔒 Your Urban Harvest Hub password was changed',
    template: 'password-changed',
    variables: { FIRST_NAME: firstName },
  });
}
