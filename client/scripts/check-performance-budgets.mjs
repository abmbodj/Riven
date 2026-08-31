import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist');
const LIMITS = {
    precacheEntries: 20,
    precacheBytes: 750 * 1024,
    shellJavaScriptGzip: 250 * 1024,
    shellCssGzip: 35 * 1024,
    dashboardJavaScriptGzip: 100 * 1024,
};
const FORBIDDEN_EAGER = /adsense|tiptap|prosemirror|pdf|mermaid|katex|chart|recharts|docx|document-preview/i;

function readDist(relativePath) {
    return readFileSync(resolve(DIST, relativePath));
}

function gzipBytes(relativePath) {
    return gzipSync(readDist(relativePath)).byteLength;
}

function formatKiB(bytes) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
}

function fail(message) {
    process.stderr.write(`Performance budget failed: ${message}\n`);
    process.exitCode = 1;
}

const html = readDist('index.html').toString();
const shellScripts = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="\/([^"]+\.js)"/g)]
    .map((match) => match[1]);
const shellCss = [...html.matchAll(/<link[^>]+href="\/([^"]+\.css)"/g)]
    .map((match) => match[1]);
const shellJavaScriptGzip = shellScripts.reduce((total, file) => total + gzipBytes(file), 0);
const shellCssGzip = shellCss.reduce((total, file) => total + gzipBytes(file), 0);

const serviceWorker = readDist('sw.js').toString();
const precacheMatch = serviceWorker.match(/precacheAndRoute\((\[[\s\S]*?\])(?:,\{\})?\)/);
if (!precacheMatch) {
    fail('could not read Workbox precache entries from dist/sw.js');
}
const precacheEntries = precacheMatch
    ? [...precacheMatch[1].matchAll(/url:"([^"]+)"/g)].map((match) => ({ url: match[1] }))
    : [];
const uniquePrecacheFiles = [...new Set(precacheEntries.map(({ url }) => url))];
const precacheBytes = uniquePrecacheFiles.reduce((total, file) => {
    try {
        return total + statSync(resolve(DIST, file)).size;
    } catch {
        return total;
    }
}, 0);

const manifest = JSON.parse(readDist('.vite/manifest.json'));
const dashboardEntry = Object.entries(manifest).find(([source]) => source.endsWith('/pages/Home.jsx'));
if (!dashboardEntry) {
    fail('could not find the dashboard route in the Vite manifest');
}

function collectImports(chunk, files = new Set()) {
    if (!chunk || files.has(chunk.file)) return files;
    if (chunk.file?.endsWith('.js')) files.add(chunk.file);
    for (const source of chunk.imports || []) collectImports(manifest[source], files);
    return files;
}

const dashboardScripts = dashboardEntry ? collectImports(dashboardEntry[1]) : new Set();
for (const shellScript of shellScripts) dashboardScripts.delete(shellScript);
const dashboardJavaScriptGzip = [...dashboardScripts]
    .reduce((total, file) => total + gzipBytes(file), 0);

if (precacheEntries.length > LIMITS.precacheEntries) {
    fail(`PWA precache has ${precacheEntries.length} entries (limit ${LIMITS.precacheEntries})`);
}
if (precacheBytes > LIMITS.precacheBytes) {
    fail(`PWA precache is ${formatKiB(precacheBytes)} (limit ${formatKiB(LIMITS.precacheBytes)})`);
}
if (shellJavaScriptGzip > LIMITS.shellJavaScriptGzip) {
    fail(`universal shell JavaScript is ${formatKiB(shellJavaScriptGzip)} gzip (limit ${formatKiB(LIMITS.shellJavaScriptGzip)})`);
}
if (shellCssGzip > LIMITS.shellCssGzip) {
    fail(`universal CSS is ${formatKiB(shellCssGzip)} gzip (limit ${formatKiB(LIMITS.shellCssGzip)})`);
}
if (dashboardJavaScriptGzip > LIMITS.dashboardJavaScriptGzip) {
    fail(`dashboard incremental JavaScript is ${formatKiB(dashboardJavaScriptGzip)} gzip (limit ${formatKiB(LIMITS.dashboardJavaScriptGzip)})`);
}

const forbiddenShellChunks = shellScripts.filter((file) => FORBIDDEN_EAGER.test(basename(file)));
if (forbiddenShellChunks.length) {
    fail(`forbidden feature chunks are eager: ${forbiddenShellChunks.join(', ')}`);
}

process.stdout.write([
    `PWA precache: ${precacheEntries.length} entries, ${formatKiB(precacheBytes)}`,
    `Universal shell JavaScript: ${formatKiB(shellJavaScriptGzip)} gzip`,
    `Universal CSS: ${formatKiB(shellCssGzip)} gzip`,
    `Dashboard incremental JavaScript: ${formatKiB(dashboardJavaScriptGzip)} gzip`,
    'Forbidden eager feature chunks: none',
].join('\n') + '\n');
