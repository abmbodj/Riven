import { describe, it, expect } from 'vitest';

describe('Server Smoke Test', () => {
    it('should pass a basic math check', () => {
        expect(1 + 1).toBe(2);
    });
});
