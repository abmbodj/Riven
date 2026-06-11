import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(testDir, '..');

const readServerFile = async (relativePath) => readFile(path.resolve(serverRoot, relativePath), 'utf8');

describe('server socket decommission', () => {
    it('removes Socket.IO from the Express runtime', async () => {
        const [packageJsonRaw, indexSource] = await Promise.all([
            readServerFile('package.json'),
            readServerFile('index.js'),
        ]);

        const packageJson = JSON.parse(packageJsonRaw);

        expect(packageJson.dependencies?.['socket.io']).toBeUndefined();
        expect(indexSource).not.toMatch(/socket\.io/);
        expect(indexSource).not.toMatch(/connectedUsers/);
        expect(indexSource).not.toMatch(/join-room/);
        expect(indexSource).not.toMatch(/leave-room/);
        expect(indexSource).not.toMatch(/typing/);
    });
});
