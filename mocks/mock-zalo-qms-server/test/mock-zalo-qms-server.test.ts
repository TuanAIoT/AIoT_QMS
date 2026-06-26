import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockZaloQmsServer, type MockZaloQmsServer } from '../src/index.js';

let server: MockZaloQmsServer;
let baseUrl: string;

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ readonly status: number; readonly body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  return { status: response.status, body: (await response.json()) as T };
}

beforeEach(async () => {
  server = createMockZaloQmsServer();
  const port = await server.listen(0);
  baseUrl = `http://127.0.0.1:${String(port)}`;
});

afterEach(async () => {
  await server.close();
});

describe('mock zalo qms server', () => {
  it('returns health status', async () => {
    const result = await request<{ readonly ok: true }>('/health');

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it('lists deterministic services without PII', async () => {
    const result = await request<{
      readonly ok: true;
      readonly data: readonly { readonly id: string; readonly code: string; readonly name: string }[];
    }>('/api/zalo/services');

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([
      { id: 'medical', code: 'A', name: 'Khám bệnh' },
      { id: 'payment', code: 'B', name: 'Thanh toán' },
      { id: 'consulting', code: 'C', name: 'Tư vấn' },
    ]);
    expect(JSON.stringify(result.body)).not.toMatch(/cccd|phone|email|address|citizen/i);
  });

  it('creates and fetches a waiting ticket', async () => {
    const created = await request<{
      readonly ok: true;
      readonly data: {
        readonly ticketId: string;
        readonly ticketNumber: string;
        readonly serviceId: string;
        readonly serviceName: string;
        readonly status: string;
        readonly waitingAhead: number;
        readonly createdAt: string;
      };
    }>('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'medical' }),
    });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      ticketNumber: 'A001',
      serviceId: 'medical',
      serviceName: 'Khám bệnh',
      status: 'WAITING',
      waitingAhead: 0,
    });

    const fetched = await request<typeof created.body>(
      `/api/zalo/tickets/${created.body.data.ticketId}`,
    );
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.ticketNumber).toBe('A001');
  });

  it('rejects unknown fields and invalid service', async () => {
    const unknownField = await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'medical', phone: '0123456789' }),
    });
    const invalidService = await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'missing' }),
    });

    expect(unknownField.status).toBe(400);
    expect(invalidService.status).toBe(400);
  });

  it('resets state and supports call-next simulation', async () => {
    await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'medical' }),
    });
    const called = await request<{
      readonly ok: true;
      readonly data: { readonly ticket: { readonly status: string; readonly ticketNumber: string } | null };
    }>('/api/zalo/dev/call-next', { method: 'POST' });

    expect(called.body.data.ticket).toMatchObject({ ticketNumber: 'A001', status: 'CALLED' });

    await request('/api/zalo/dev/reset', { method: 'POST' });
    const createdAfterReset = await request<{
      readonly ok: true;
      readonly data: { readonly ticketNumber: string };
    }>('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'medical' }),
    });

    expect(createdAfterReset.body.data.ticketNumber).toBe('A001');
  });

  it('handles CORS preflight for browser development', async () => {
    const response = await fetch(`${baseUrl}/api/zalo/services`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5173');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });
});
