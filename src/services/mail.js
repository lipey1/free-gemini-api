const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

let transporter = null;

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

function getTransporter() {
  if (transporter) return transporter;
  if (!smtpConfigured()) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function fromAddress() {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    "noreply@freegemini.local"
  );
}

/**
 * Sends email when SMTP is configured; otherwise logs the payload so local
 * development and password-reset flows still work without a mail server.
 */
async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    logger.warn?.(
      `[mail] SMTP not configured — message to ${to}: ${subject}\n${text}`,
    );
    return { ok: true, queued: false, logged: true };
  }

  await tx.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html: html || undefined,
  });
  return { ok: true, queued: true, logged: false };
}

function publicBaseUrl() {
  return String(
    process.env.PUBLIC_BASE_URL ||
      process.env.SITE_URL ||
      "http://localhost:3333",
  ).replace(/\/$/, "");
}

module.exports = {
  sendMail,
  smtpConfigured,
  publicBaseUrl,
};
