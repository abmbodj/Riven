
const BASE_URLS = [
    'https://riven-wa9y.onrender.com/api',
    'https://riven-wa9y.onrender.com',
    'https://riven-virid.vercel.app/api',
    'https://riven-virid.vercel.app'
];

async function testEndpoint(baseUrl) {
    // Construct the full URL.
    // Ensure we don't end up with double slashes if baseUrl ends with /
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBase}/auth/login`;

    console.log(`Testing: ${url}`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'password' })
        });
        const text = await res.text();
        const isJson = text.trim().startsWith('{');
        console.log(`Status: ${res.status}`);
        console.log(`Is JSON? ${isJson}`);
        console.log(`Preview: ${text.slice(0, 100).replace(/\n/g, '\\n')}`);
        console.log('---');
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

(async () => {
    for (const base of BASE_URLS) {
        await testEndpoint(base);
    }
})();
