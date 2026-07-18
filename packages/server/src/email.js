function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const PUBLIC_SERVER_URL = env("PUBLIC_SERVER_URL", "http://localhost:8787");
const APP_NAME = "Lucy Call";

/**
 * Sends the email-verification link. Uses SMTP (nodemailer) when SMTP_* env is
 * set; otherwise logs the link to the server console so local dev works without
 * an email provider.
 */
export async function sendVerificationEmail(to, token) {
  const link = `${PUBLIC_SERVER_URL}/api/auth/confirm?token=${encodeURIComponent(token)}`;
  const smtpHost = env("SMTP_HOST", "");
  if (smtpHost) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: Number(env("SMTP_PORT", "587")),
        secure: Number(env("SMTP_PORT", "587")) === 465,
        auth: { user: env("SMTP_USER", ""), pass: env("SMTP_PASS", "") },
      });
      await transport.sendMail({
        from: env("SMTP_FROM", APP_NAME),
        to,
        subject: `Verify your ${APP_NAME} email`,
        html: `<p>Confirm your email to activate your ${APP_NAME} account:</p><p><a href="${link}">${link}</a></p>`,
      });
      console.log(`[email] sent verification to ${to}`);
    } catch (e) {
      console.warn(`[email] SMTP send failed for ${to}:`, e.message);
      console.log(`[email] fallback link for ${to}: ${link}`);
    }
    return;
  }
  console.log(`\n[email] Verify ${to} → ${link}\n`);
}
