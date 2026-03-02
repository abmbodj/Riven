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
        // Dev fallback: log to console
        console.log(`\n📧 [EMAIL] To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Body: ${html.substring(0, 200)}...`);
        console.log('   (Set RESEND_API_KEY to send real emails)\n');
        return { id: 'dev-console-log' };
    }

    const { data, error } = await client.emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (error) throw new Error(error.message);
    return data;
}

async function sendPasswordResetEmail(email, resetToken, baseUrl) {
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const html = `
    <div style="font-family: 'Georgia', serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #162a31; color: #e4ddd0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; letter-spacing: 4px; color: #deb96a; margin: 0;">RIVEN</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: normal; margin-bottom: 16px;">Reset Your Password</h2>
        <p style="color: #8fa6a8; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset the password for your account. Click the button below to choose a new password.
        </p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #deb96a; color: #162a31; text-decoration: none; border-radius: 8px; font-weight: bold; letter-spacing: 1px;">
                RESET PASSWORD
            </a>
        </div>
        <p style="color: #8fa6a8; font-size: 13px; line-height: 1.6;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #233e46; margin: 32px 0;" />
        <p style="color: #8fa6a8; font-size: 11px; text-align: center;">
            Riven — Cultivate your knowledge
        </p>
    </div>`;

    return sendEmail({ to: email, subject: 'Reset your Riven password', html });
}

async function sendEmailVerification(email, verifyToken, baseUrl) {
    const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;

    const html = `
    <div style="font-family: 'Georgia', serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #162a31; color: #e4ddd0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; letter-spacing: 4px; color: #deb96a; margin: 0;">RIVEN</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: normal; margin-bottom: 16px;">Verify Your Email</h2>
        <p style="color: #8fa6a8; line-height: 1.6; margin-bottom: 24px;">
            Welcome to Riven! Please verify your email address to complete your account setup.
        </p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: #7a9e72; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; letter-spacing: 1px;">
                VERIFY EMAIL
            </a>
        </div>
        <p style="color: #8fa6a8; font-size: 13px; line-height: 1.6;">
            This link expires in 24 hours.
        </p>
        <hr style="border: none; border-top: 1px solid #233e46; margin: 32px 0;" />
        <p style="color: #8fa6a8; font-size: 11px; text-align: center;">
            Riven — Cultivate your knowledge
        </p>
    </div>`;

    return sendEmail({ to: email, subject: 'Verify your Riven email', html });
}

module.exports = { sendEmail, sendPasswordResetEmail, sendEmailVerification };
