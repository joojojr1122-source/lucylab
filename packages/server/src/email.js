function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const PUBLIC_SERVER_URL = env("PUBLIC_SERVER_URL", "http://localhost:8787");
const APP_NAME = "Lucy Call";

/**
 * Sends the email-verification link. In production, wire SMTP (e.g. nodemailer) here.
 * When SMTP_* env is not set, we fall back to logging the link to the server console
 * so local dev works without an email provider.
 */
export async function sendVerificationEmail(to, token) {
  const link = `${PUBLIC_SERVER_URL}/api/auth/confirm?token=${encodeURIComponent(token)}`;
  const smtpHost = env("SMTP_HOST", "");
  if (smtpHost) {
    // Production: send via SMTP. Requires `nodemailer` (add to package.json).
    // const nodemailer = (await import("nodemailer")).default;
    // const t = nodemailer.createTransport({ host: smtpHost, port: Number(env("SMTP_PORT","587")), auth: { user: env("SMTP_USER",""), pass: env("SMTP_PASS","") } });
    // await t.sendMail({ from: env("SMTP_FROM", APP_NAME), to, subject: `Verify your ${APP_NAME} email`, html: `<p>Confirm: <a href="${link}">${link}</a></p>` });
    console.log(`[email] (SMTP configured but nodemailer not installed) verification link for ${to}: ${link}`);
    return;
  }
  console.log(`\n[email] Verify ${to} → ${link}\n`);
}
