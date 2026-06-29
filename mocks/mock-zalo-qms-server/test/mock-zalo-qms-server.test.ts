// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockZaloQmsServer, type MockZaloQmsServer } from '../src/index.js';
import { MockZaloQmsState } from '../src/state.js';

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
  it('serves deterministic locations, areas and services', async () => {
    const locations = await request<{ readonly ok: true; readonly data: readonly { readonly locationId: string; readonly locationName: string; readonly address: string }[] }>('/api/zalo/locations');
    const areas = await request<{ readonly ok: true; readonly data: readonly { readonly areaId: string; readonly areaName: string; readonly locationId: string }[] }>('/api/zalo/locations/loc-cumta/areas');
    const services = await request<{ readonly ok: true; readonly data: readonly { readonly serviceId: string; readonly serviceName: string; readonly areaId: string }[] }>('/api/zalo/locations/loc-cumta/services?areaId=area-justice');
    const longLocationServices = await request<{ readonly ok: true; readonly data: readonly { readonly serviceId: string; readonly locationId: string }[] }>('/api/zalo/locations/loc-thuduc-long/services');

    expect(locations.status).toBe(200);
    expect(areas.status).toBe(200);
    expect(services.status).toBe(200);
    expect(longLocationServices.status).toBe(200);
    expect(locations.body.data[0]?.locationId).toBe('loc-cumta');
    expect(locations.body.data.length).toBeGreaterThanOrEqual(10);
    expect(locations.body.data.some((location) => location.locationName.includes('Thủ Đức'))).toBe(true);
    expect(areas.body.data[0]?.areaId).toBe('area-justice');
    expect(areas.body.data.every((area) => area.locationId === 'loc-cumta')).toBe(true);
    expect(services.body.data[0]?.areaId).toBe('area-justice');
    expect(longLocationServices.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('creates a booking and exposes current/history/queue data', async () => {
    const created = await request<{ readonly ok: true; readonly data: { readonly ticketId: string; readonly ticketNumber: string; readonly fullName: string } }>('/api/zalo/bookings', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', areaId: 'area-justice', serviceId: 'svc-justice-1', fullName: 'Nguyễn Văn A', bookingDate: '2026-06-27' }),
    });
    const current = await request<{ readonly ok: true; readonly data: unknown | null }>('/api/zalo/locations/loc-cumta/bookings/current');
    await request('/api/zalo/dev/call-next', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta' }),
    });
    const history = await request<{ readonly ok: true; readonly data: readonly unknown[] }>('/api/zalo/locations/loc-cumta/bookings/history');
    const queue = await request<{ readonly ok: true; readonly data: { readonly counters: readonly unknown[] } }>('/api/zalo/locations/loc-cumta/queue-status');

    expect(created.status).toBe(201);
    expect(created.body.data.fullName).toBe('Nguyễn Văn A');
    expect(current.body.data).not.toBeNull();
    expect(history.body.data.length).toBeGreaterThanOrEqual(1);
    expect(queue.body.data.counters.length).toBe(4);
  });

  it('queues a booking at the matching service and never exposes PII in queue status', async () => {
    await request('/api/zalo/bookings', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-cumta', areaId: 'area-social', serviceId: 'svc-social-1', fullName: 'Người dùng thử', bookingDate: '2026-06-27' }),
    });
    const queue = await request<{ readonly data: { readonly counters: readonly { readonly serviceId: string; readonly waitingCount: number }[] } }>('/api/zalo/locations/loc-cumta/queue-status');
    expect(queue.body.data.counters.find((counter) => counter.serviceId === 'svc-social-1')?.waitingCount).toBe(1);
    expect(JSON.stringify(queue.body)).not.toContain('Người dùng thử');
    expect(JSON.stringify(queue.body)).not.toContain('fullName');
    expect(JSON.stringify(queue.body)).not.toContain('qrPayload');
  });

  it('ticks deterministically to call and then complete the current ticket', () => {
    const state = new MockZaloQmsState();
    const ticket = state.createBooking('loc-cumta', 'area-justice', 'svc-justice-1', 'Người dùng thử', '2026-06-27');
    state.tickQueueSimulation('loc-cumta');
    expect(state.getTicket(ticket.ticketId).status).toBe('SERVING');
    expect(state.getQueueStatus('loc-cumta').counters.find((counter) => counter.serviceId === 'svc-justice-1')?.currentTicket?.ticketId).toBe(ticket.ticketId);
    state.tickQueueSimulation('loc-cumta');
    expect(state.getTicket(ticket.ticketId).status).toBe('COMPLETED');
    expect(state.getCurrentBooking('loc-cumta')).toBeNull();
    expect(state.listHistory('loc-cumta').some((item) => item.ticketId === ticket.ticketId)).toBe(true);
  });

  it('rejects mismatched service and keeps CORS enabled', async () => {
    const response = await fetch(`${baseUrl}/api/zalo/bookings`, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: 'loc-cumta', areaId: 'area-social', serviceId: 'svc-justice-1', fullName: 'Nguyễn Văn A', bookingDate: '2026-06-27' }),
    });

    expect(response.status).toBe(409);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects unknown fields and invalid booking dates', async () => {
    const unknownField = await request('/api/zalo/bookings', {
      method: 'POST',
      body: JSON.stringify({
        locationId: 'loc-cumta',
        areaId: 'area-justice',
        serviceId: 'svc-justice-1',
        fullName: 'Nguyễn Văn A',
        bookingDate: '2026-06-27',
        phone: 'not-allowed',
      }),
    });
    const invalidDate = await request('/api/zalo/bookings', {
      method: 'POST',
      body: JSON.stringify({
        locationId: 'loc-cumta',
        areaId: 'area-justice',
        serviceId: 'svc-justice-1',
        fullName: 'Nguyễn Văn A',
        bookingDate: '2026-02-30',
      }),
    });

    expect(unknownField.status).toBe(400);
    expect(invalidDate.status).toBe(400);
  });

  it('supports health, CORS preflight and deterministic reset', async () => {
    expect((await request('/health')).status).toBe(200);
    const preflight = await fetch(`${baseUrl}/api/zalo/locations`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');

    await request('/api/zalo/bookings', {
      method: 'POST',
      body: JSON.stringify({
        locationId: 'loc-cumta',
        areaId: 'area-justice',
        serviceId: 'svc-justice-1',
        fullName: 'Nguyễn Văn A',
        bookingDate: '2026-06-27',
      }),
    });
    await request('/api/zalo/dev/reset', { method: 'POST' });
    const tickets = await request<{ readonly ok: true; readonly data: readonly unknown[] }>(
      '/api/zalo/bookings?locationId=loc-cumta',
    );
    expect(tickets.body.data).toEqual([]);
  });
});
