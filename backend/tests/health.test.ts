import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health and System Endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 and liveness status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('atti-api');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('GET /ready returns readiness structure', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('redis');
  });

  it('GET /non-existent-route returns 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Endpoint not found');
  });
});

