import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockZaloQmsServer, type MockZaloQmsServer } from '../src/index.js';

let server: MockZaloQmsServer;
let baseUrl: string;

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ readonly status: number; readonly body: T; readonly response: Response }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  return { status: response.status, body: (await response.json()) as T, response };
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

  it('lists deterministic locations and services without PII', async () => {
    const locations = await request<{
      readonly ok: true;
      readonly data: readonly { readonly locationId: string; readonly locationName: string }[];
    }>('/api/zalo/locations');
    const services = await request<{
      readonly ok: true;
      readonly data: readonly { readonly serviceId: string; readonly serviceName: string }[];
    }>('/api/zalo/services');

    expect(locations.status).toBe(200);
    expect(locations.body.data).toHaveLength(10);
    expect(locations.body.data[0]?.locationName).toContain('TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG');
    expect(services.status).toBe(200);
    expect(services.body.data).toHaveLength(5);
    expect(JSON.stringify({ locations: locations.body, services: services.body })).not.toMatch(
      /cccd|phone|email|citizen/i,
    );
  });

  it('creates, lists, fetches and cancels a booking', async () => {
    const created = await request<{
      readonly ok: true;
      readonly data: {
        readonly ticketId: string;
        readonly ticketNumber: string;
        readonly locationId: string;
        readonly locationName: string;
        readonly serviceId: string;
        readonly serviceName: string;
        readonly status: string;
        readonly canCancel: boolean;
      };
    }>('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', serviceId: 'svc-med' }),
    });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      ticketNumber: '0001',
      locationId: 'loc-cumta',
      serviceId: 'svc-med',
      status: 'WAITING',
      canCancel: true,
    });

    const listed = await request<{
      readonly ok: true;
      readonly data: readonly { readonly ticketId: string; readonly ticketNumber: string }[];
    }>('/api/zalo/tickets?locationId=loc-cumta');
    expect(listed.body.data).toHaveLength(1);

    const fetched = await request<typeof created.body>(`/api/zalo/tickets/${created.body.data.ticketId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.ticketNumber).toBe('0001');

    const cancelled = await request<typeof created.body>(
      `/api/zalo/tickets/${created.body.data.ticketId}/cancel`,
      { method: 'POST' },
    );
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });

  it('rejects unknown fields and invalid service', async () => {
    const unknownField = await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', serviceId: 'svc-med', phone: '0123456789' }),
    });
    const invalidService = await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', serviceId: 'missing' }),
    });

    expect(unknownField.status).toBe(400);
    expect(invalidService.status).toBe(400);
  });

  it('supports queue status and call-next simulation', async () => {
    await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', serviceId: 'svc-med' }),
    });
    const queueStatus = await request<{
      readonly ok: true;
      readonly data: {
        readonly locationId: string;
        readonly counters: readonly { readonly counterName: string; readonly currentTicketNumber: string | null }[];
        readonly waitingTickets: readonly { readonly ticketNumber: string }[];
      };
    }>('/api/zalo/locations/loc-cumta/queue-status');
    expect(queueStatus.body.data.counters).toHaveLength(3);
    expect(queueStatus.body.data.waitingTickets).toHaveLength(1);

    const called = await request<{
      readonly ok: true;
      readonly data: { readonly ticket: { readonly status: string; readonly ticketNumber: string } | null };
    }>('/api/zalo/dev/call-next', { method: 'POST' });
    expect(called.body.data.ticket).toMatchObject({ ticketNumber: '0001', status: 'CALLED' });
  });

  it('resets state back to the initial seed', async () => {
    await request('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', serviceId: 'svc-med' }),
    });
    await request('/api/zalo/dev/reset', { method: 'POST' });
    const createdAfterReset = await request<{
      readonly ok: true;
      readonly data: { readonly ticketNumber: string };
    }>('/api/zalo/tickets', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', serviceId: 'svc-med' }),
    });

    expect(createdAfterReset.body.data.ticketNumber).toBe('0001');
  });

  it('handles CORS preflight for browser development', async () => {
    const response = await fetch(`${baseUrl}/api/zalo/locations`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });
});
