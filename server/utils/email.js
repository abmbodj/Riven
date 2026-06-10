const { Resend } = require('resend');

// Initialize Resend client (set RESEND_API_KEY in .env)
let resend = null;

function getClient() {
    if (resend) return resend;
    if (process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Riven <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
    const client = getClient();

    if (!client) {
        console.log(`\n📧 [EMAIL] To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   (Set RESEND_API_KEY to send real emails)\n`);
        return { id: 'dev-console-log' };
    }

    const { data, error } = await client.emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (error) throw new Error(error.message);
    return data;
}

// ============================================================
// Shared email shell — every email uses this wrapper
// Matches Riven's design tokens exactly:
//   bg: #162a31  surface: #1e3840  text: #e4ddd0
//   muted: #8fa6a8  border: #233e46  accent: #deb96a
//   forest: #7a9e72  fonts: Georgia/serif (email-safe fallback)
// ============================================================

function emailShell(content) {
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #10202a; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #10202a; padding: 40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(180deg, #1e3840 0%, #162a31 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 30px rgba(0,0,0,0.3);">
        
        <!-- Header -->
        <tr><td style="padding: 36px 32px 0 32px; text-align: center;">
          <div style="display: inline-block; padding: 8px 20px; border: 1px solid rgba(222,185,106,0.3); border-radius: 6px;">
            <span style="font-size: 22px; letter-spacing: 6px; color: #deb96a; font-weight: 400;">RIVEN</span>
          </div>
        </td></tr>

        <!-- Divider line -->
        <tr><td style="padding: 20px 32px 0;">
          <div style="height: 1px; background: linear-gradient(90deg, transparent, #233e46, transparent);"></div>
        </td></tr>
        
        <!-- Content -->
        <tr><td style="padding: 28px 32px 0 32px;">
          ${content}
        </td></tr>

        <!-- Footer divider -->
        <tr><td style="padding: 32px 32px 0;">
          <div style="height: 1px; background: linear-gradient(90deg, transparent, #233e46, transparent);"></div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding: 20px 32px 28px; text-align: center;">
          <span style="font-size: 11px; color: #5f7b7e; letter-spacing: 2px;">CULTIVATE YOUR KNOWLEDGE</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function primaryButton(text, url) {
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
      <tr><td align="center">
        <a href="${url}" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #deb96a 0%, #c9a24e 100%); color: #162a31; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 13px; letter-spacing: 2px; box-shadow: 0 4px 20px rgba(222,185,106,0.25);">
          ${text}
        </a>
      </td></tr>
    </table>`;
}

function secondaryButton(text, url) {
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 12px 0;">
      <tr><td align="center">
        <a href="${url}" style="display: inline-block; padding: 12px 28px; background: transparent; color: #8fa6a8; text-decoration: none; border-radius: 8px; font-size: 13px; letter-spacing: 1px; border: 1px solid #233e46;">
          ${text}
        </a>
      </td></tr>
    </table>`;
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// Welcome Email
// ============================================================

const WELCOME_EMAIL_SUBJECT = 'Welcome to Riven';

function buildWelcomeEmailHtml(username, baseUrl) {
    const appUrl = baseUrl || 'https://riven.rocks';
    const safeUsername = escapeHtml(username);

    return emailShell(`
        <p style="color: #deb96a; font-size: 11px; letter-spacing: 2px; margin: 0 0 14px; font-weight: bold;">WELCOME TO RIVEN</p>
        <h2 style="font-size: 28px; font-weight: 400; color: #e4ddd0; margin: 0 0 12px; line-height: 1.2;">
          Your account is ready, ${safeUsername}
        </h2>
        <p style="color: #8fa6a8; font-size: 15px; line-height: 1.7; margin: 0 0 6px;">
          Riven helps you turn class material into focused study sessions with flashcards, AI tools, and spaced repetition.
        </p>
        <p style="color: #8fa6a8; font-size: 15px; line-height: 1.7; margin: 0;">
          The fastest way to get started is to add your material, generate what you need, and study your first set today.
        </p>

        ${primaryButton('OPEN RIVEN', `${appUrl}/onboarding`)}
        ${secondaryButton('CREATE A DECK', `${appUrl}/create`)}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
          <tr><td style="padding: 18px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
            <p style="color: #e4ddd0; font-size: 13px; line-height: 1.5; margin: 0 0 12px; font-weight: bold;">
              A simple first session
            </p>
            <p style="color: #8fa6a8; font-size: 13px; line-height: 1.8; margin: 0;">
              Add notes, slides, or a topic you want to learn.<br>
              Generate flashcards or build a deck yourself.<br>
              Review a few cards and start your streak.
            </p>
          </td></tr>
        </table>
    `);
}

async function sendWelcomeEmail(email, username, baseUrl) {
    const html = buildWelcomeEmailHtml(username, baseUrl);
    return sendEmail({ to: email, subject: WELCOME_EMAIL_SUBJECT, html });
}

// ============================================================
// Password Reset Email
// ============================================================

async function sendPasswordResetEmail(email, resetToken, baseUrl) {
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const html = emailShell(`
        <h2 style="font-size: 24px; font-weight: 400; color: #e4ddd0; margin: 0 0 8px; line-height: 1.3;">
          Reset your password
        </h2>
        <p style="color: #8fa6a8; font-size: 15px; line-height: 1.7; margin: 0;">
          We received a request to reset your password. Use the button below to choose a new one.
        </p>

        ${primaryButton('RESET PASSWORD', resetUrl)}

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 14px 16px; background: rgba(222,185,106,0.06); border-radius: 8px; border-left: 3px solid #deb96a;">
            <p style="color: #8fa6a8; font-size: 12px; line-height: 1.6; margin: 0;">
              This link expires in <strong style="color: #e4ddd0;">1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.
            </p>
          </td></tr>
        </table>
    `);

    return sendEmail({ to: email, subject: 'Reset your Riven password', html });
}

// ============================================================
// Email Verification
// ============================================================

async function sendEmailVerification(email, verifyToken, baseUrl) {
    const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;

    const html = emailShell(`
        <h2 style="font-size: 24px; font-weight: 400; color: #e4ddd0; margin: 0 0 8px; line-height: 1.3;">
          Verify your email
        </h2>
        <p style="color: #8fa6a8; font-size: 15px; line-height: 1.7; margin: 0;">
          One last step — confirm your email address to secure your account.
        </p>

        ${primaryButton('VERIFY EMAIL', verifyUrl)}

        <p style="color: #5f7b7e; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
          This link expires in 24 hours.
        </p>
    `);

    return sendEmail({ to: email, subject: 'Verify your Riven email', html });
}

module.exports = {
    sendPasswordResetEmail,
    sendWelcomeEmail,
    WELCOME_EMAIL_SUBJECT,
    buildWelcomeEmailHtml,
};
