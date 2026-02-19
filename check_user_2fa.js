const db = require('./server/db');
require('dotenv').config({ path: './server/.env' });

async function check2FA() {
    try {
        const user = await db.queryOne('SELECT id, email, two_fa_enabled, two_fa_secret FROM users WHERE email = $1', ['pmbodj49@gmail.com']);
        console.log('User 2FA Status:', {
            id: user.id,
            email: user.email,
            enabled: user.two_fa_enabled,
            hasSecret: !!user.two_fa_secret,
            secretLength: user.two_fa_secret ? user.two_fa_secret.length : 0
        });
        process.exit(0);
    } catch (err) {
        console.error('Error checking 2FA:', err);
        process.exit(1);
    }
}

check2FA();
