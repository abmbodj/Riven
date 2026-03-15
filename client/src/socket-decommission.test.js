import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(srcDir, '..');

const readClientFile = async (relativePath) => readFile(path.resolve(clientRoot, relativePath), 'utf8');

describe('client socket decommission', () => {
  it('removes Socket.IO from the migrated realtime client paths', async () => {
    const [
      packageJsonRaw,
      authContextSource,
      authContextDefSource,
      messagesSource,
      groupDetailsSource,
      groupCramSource,
    ] = await Promise.all([
      readClientFile('package.json'),
      readClientFile('src/context/AuthContext.jsx'),
      readClientFile('src/context/authContextDef.js'),
      readClientFile('src/pages/Messages.jsx'),
      readClientFile('src/pages/GroupDetails.jsx'),
      readClientFile('src/pages/GroupCram.jsx'),
    ]);

    const packageJson = JSON.parse(packageJsonRaw);

    expect(packageJson.dependencies?.['socket.io-client']).toBeUndefined();
    expect(authContextSource).not.toMatch(/\bsocket\.io-client\b/);
    expect(authContextSource).not.toMatch(/\bsocket\b/);
    expect(authContextDefSource).not.toMatch(/\bsocket\b/);
    expect(messagesSource).not.toMatch(/\bsocket\b/);
    expect(groupDetailsSource).not.toMatch(/\bsocket\b/);
    expect(groupCramSource).not.toMatch(/\bsocket\b/);
  });
});
