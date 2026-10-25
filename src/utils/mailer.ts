import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!env.smtp.host) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(input: SendMailInput): Promise<{ delivered: boolean }> {
  const client = getTransporter();
  if (!client) {
    return { delivered: false };
  }

  await client.sendMail({
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo,
  });

  return { delivered: true };
}
