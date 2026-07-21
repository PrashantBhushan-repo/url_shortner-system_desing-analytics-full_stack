import nodemailer from "nodemailer";
import { config } from "../config/config.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || config.smtp.host,
  port: Number(process.env.SMTP_PORT || config.smtp.port || 587),
  secure: (process.env.SMTP_SECURE || "false") === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.password }
      : undefined,
});

export const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.FROM_EMAIL || config.smtp.emailFrom;
  console.log("📧 Attempting to send email:", { from, to, subject });
  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log("✅ Email sent successfully:", { messageId: info.messageId, response: info.response });
  } catch (err) {
    console.error("❌ EMAIL SENDING FAILED:", {
      error: err.message,
      code: err.code,
      command: err.command,
      responseCode: err.responseCode,
      smtp_config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        secure: process.env.SMTP_SECURE,
      },
    });
    throw err;
  }
};
