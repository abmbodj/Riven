const FROM_ADDRESS = Deno.env.get('EMAIL_FROM') || 'Riven <onboarding@resend.dev>';

const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    console.log(`\n📧 [EMAIL] To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('   (Set RESEND_API_KEY to send real emails)\n');
    return { id: 'dev-console-log' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    }),
  });

  const responseText = await response.text();
  const responseBody = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    const error = new Error(responseBody?.message || responseBody?.error || 'Failed to send email');
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return responseBody;
};

const emailShell = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #10202a; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #10202a; padding: 40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(180deg, #1e3840 0%, #162a31 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 30px rgba(0,0,0,0.3);">
        <tr><td style="padding: 36px 32px 0 32px; text-align: center;">
          <div style="display: inline-block; padding: 8px 20px; border: 1px solid rgba(222,185,106,0.3); border-radius: 6px;">
            <span style="font-size: 22px; letter-spacing: 6px; color: #deb96a; font-weight: 400;">RIVEN</span>
          </div>
        </td></tr>
        <tr><td style="padding: 20px 32px 0;">
          <div style="height: 1px; background: linear-gradient(90deg, transparent, #233e46, transparent);"></div>
        </td></tr>
        <tr><td style="padding: 28px 32px 0 32px;">
          ${content}
        </td></tr>
        <tr><td style="padding: 32px 32px 0;">
          <div style="height: 1px; background: linear-gradient(90deg, transparent, #233e46, transparent);"></div>
        </td></tr>
        <tr><td style="padding: 20px 32px 28px; text-align: center;">
          <span style="font-size: 11px; color: #5f7b7e; letter-spacing: 2px;">CULTIVATE YOUR KNOWLEDGE</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const primaryButton = (text: string, url: string) => `
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
  <tr><td align="center">
    <a href="${url}" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #deb96a 0%, #c9a24e 100%); color: #162a31; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 13px; letter-spacing: 2px; box-shadow: 0 4px 20px rgba(222,185,106,0.25);">
      ${text}
    </a>
  </td></tr>
</table>`;

export const sendWelcomeEmail = async (email: string, username: string) => {
  const appUrl = Deno.env.get('FRONTEND_URL') || 'https://www.riven.rocks';

  const html = emailShell(`
    <h2 style="font-size: 24px; font-weight: 400; color: #e4ddd0; margin: 0 0 8px; line-height: 1.3;">
      Welcome, ${username}
    </h2>
    <p style="color: #8fa6a8; font-size: 15px; line-height: 1.7; margin: 0 0 4px;">
      Your garden has been planted. Riven is where knowledge takes root — create decks, study with spaced repetition, and watch your mastery grow.
    </p>

    ${primaryButton('BEGIN STUDYING', `${appUrl}/decks`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
      <tr><td style="padding: 16px; background: rgba(122,158,114,0.08); border-radius: 10px; border: 1px solid rgba(122,158,114,0.12);">
        <p style="color: #7a9e72; font-size: 11px; letter-spacing: 2px; margin: 0 0 10px; font-weight: bold;">GETTING STARTED</p>
        <p style="color: #8fa6a8; font-size: 13px; line-height: 1.65; margin: 0;">
          <span style="color: #deb96a;">①</span>&ensp;Create your first deck<br>
          <span style="color: #deb96a;">②</span>&ensp;Add cards — or let AI generate them<br>
          <span style="color: #deb96a;">③</span>&ensp;Study daily to grow your streak
        </p>
      </td></tr>
    </table>
  `);

  return sendEmail({ to: email, subject: 'Welcome to Riven', html });
};

export const sendPasswordResetEmail = async (email: string, resetToken: string, baseUrl: string) => {
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
          This link expires in <strong style="color: #e4ddd0;">1 hour</strong>. If you didn't request this, you can safely ignore this email - your password won't change.
        </p>
      </td></tr>
    </table>
  `);

  return sendEmail({
    to: email,
    subject: 'Reset your Riven password',
    html,
  });
};
