import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('database startup', () => {
  it('does not connect or run schema initialization when explicitly disabled', () => {
    const script = `
      const Module = require('module');
      const originalLoad = Module._load;
      Module._load = function(name, ...args) {
        if (name === 'pg') return { Pool: class {
          on() {}
          connect() { console.log('unexpected startup connection'); throw new Error('Unexpected startup connection'); }
        }};
        return originalLoad.call(this, name, ...args);
      };
      require('./db').ready().then(() => console.log('ready'));
    `;
    const output = execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgres://unused', RIVEN_SKIP_DB_INIT: 'true' },
    });
    expect(output.trim()).toBe('ready');
  });

  it('uses the request database pool in Worker mode without creating a global pool', () => {
    const script = `
      const Module = require('module');
      const originalLoad = Module._load;
      Module._load = function(name, ...args) {
        if (name === 'pg') return { Pool: class { constructor() { throw Error('global pool created'); } } };
        return originalLoad.call(this, name, ...args);
      };
      const { runWithWorkerContext } = require('./workerContext');
      const db = require('./db');
      runWithWorkerContext({ pool: { query: async () => ({rows: [{value: 42}]}) } }, async () => {
        console.log((await db.queryOne('SELECT 42')).value);
      });
    `;
    const output = execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(), encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '', RIVEN_WORKER_MODE: 'true', RIVEN_SKIP_DB_INIT: 'true' },
    });
    expect(output.trim()).toBe('42');
  });
});
