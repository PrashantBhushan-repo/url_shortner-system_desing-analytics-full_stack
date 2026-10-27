import nodemailer from "nodemailer";
import { config } from "../config/config.js";
import { AppError } from './AppError.js';

export const isSmtpConfigured = !!(
  ((process.env.SMTP_USER && process.env.SMTP_USER !== "") || (config.smtp.user && config.smtp.user !== "")) &&
  (process.env.SMTP_HOST || config.smtp.host) &&
  (process.env.SMTP_HOST !== "smtp.example.com" && config.smtp.host !== "smtp.example.com")
  && (process.env.SMTP_PASS || config.smtp.password)
);

const transporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || config.smtp.host,
      port: Number(process.env.SMTP_PORT || config.smtp.port || 587),
      secure: (process.env.SMTP_SECURE || "false") === "true",
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : { user: config.smtp.user, pass: config.smtp.password },
    })
  : null;

export const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.FROM_EMAIL || config.smtp.emailFrom || "noreply@pburls.com";

  if (!isSmtpConfigured) {
    throw new AppError('Email delivery is not configured. Please contact support.', 503);
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log("✅ Email sent successfully:", { messageId: info.messageId, response: info.response });
    return info;
  } catch (err) {
    console.error("❌ EMAIL SENDING FAILED:", {
      error: err.message,
      code: err.code,
      command: err.command,
      responseCode: err.responseCode,
      smtp_config: {
        host: process.env.SMTP_HOST || config.smtp.host,
        port: process.env.SMTP_PORT || config.smtp.port,
        user: process.env.SMTP_USER || config.smtp.user,
        secure: process.env.SMTP_SECURE,
      },
    });
    throw err;
  }
};
