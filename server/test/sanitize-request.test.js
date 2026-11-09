import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { sanitizeRequest } from '../sanitizeRequest.js';

describe('request sanitization', () => {
  it('sanitizes query and JSON body without failing on Express 5 query getters', async () => {
    const app = express();
    app.use(express.json());
    app.use(sanitizeRequest);
    app.post('/sample', (req, res) => res.json({ query: req.query, body: req.body }));
    const response = await request(app).post('/sample?search=%3Cscript%3Ealert(1)%3C%2Fscript%3E').send({ text: '<script>alert(1)</script>' });
    expect(response.status).toBe(200);
    expect(response.body.query.search).not.toContain('<script>');
    expect(response.body.body.text).not.toContain('<script>');
  });
});
