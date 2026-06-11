// RIV-002: SSRF guard for server-side fetches of user-supplied URLs (Canvas iCal).
// Requires https, rejects IP-literal private hosts, and resolves DNS to ensure the
// host does not point at internal/loopback/link-local/cloud-metadata addresses.
//
// Note: this is a pre-flight check. node-ical follows redirects, so a fully hardened
// implementation would also re-validate each hop; that residual risk is documented.

const dns = require('node:dns').promises;
const net = require('node:net');

// base CIDR, prefix bits — IPv4 ranges that must never be fetched server-side.
const PRIVATE_V4 = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16], // link-local incl. 169.254.169.254 cloud metadata
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
];

function ipv4ToInt(ip) {
    return ip.split('.').reduce((acc, oct) => ((acc << 8) + Number(oct)) >>> 0, 0) >>> 0;
}

function inV4Range(ip, base, bits) {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
        return PRIVATE_V4.some(([base, bits]) => inV4Range(ip, base, bits));
    }
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        if (lower === '::1' || lower === '::') return true;
        if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateIp(mapped[1]);
        return false;
    }
    return true; // unknown form → treat as unsafe
}

async function assertSafePublicUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }
    if (url.protocol !== 'https:') throw new Error('URL must use https');

    const host = url.hostname;
    if (net.isIP(host) && isPrivateIp(host)) {
        throw new Error('URL host is not allowed');
    }

    let addrs;
    try {
        addrs = await dns.lookup(host, { all: true });
    } catch {
        throw new Error('URL host could not be resolved');
    }
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
        throw new Error('URL host resolves to a disallowed address');
    }
}

module.exports = { assertSafePublicUrl, isPrivateIp };
