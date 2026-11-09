import { describe, expect, it } from 'vitest';
import { runWithWorkerContext, currentWorkerContext } from '../workerContext.js';

describe('Worker request context', () => {
  it('keeps overlapping requests isolated across asynchronous operations', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = runWithWorkerContext({ id: 'first' }, async () => {
      await gate;
      return currentWorkerContext().id;
    });
    const second = runWithWorkerContext({ id: 'second' }, async () => {
      release();
      await Promise.resolve();
      return currentWorkerContext().id;
    });
    expect(await Promise.all([first, second])).toEqual(['first', 'second']);
    expect(currentWorkerContext()).toBeUndefined();
  });
});
