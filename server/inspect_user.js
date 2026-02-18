
require('dotenv').config({ override: true });
const { Pool } = require('pg');

// Force using the Supabase URL provided by user
const connectionString = 'postgresql://postgres.rybcvdsocxrugelgdgsn:hb63TKxYrYjldQFO@aws-1-us-east-1.pooler.supabase.com:6543/postgres';
console.log('Connecting with:', connectionString.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function inspectUser() {
    try {
        const client = await pool.connect();
        try {
            console.log('Connected successfully!');
            const res = await client.query("SELECT * FROM users WHERE email = 'pmbodj49@gmail.com'");
            console.log('User Record:', res.rows[0]);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Connection Error:', err);
    } finally {
        pool.end();
    }
}

inspectUser();
