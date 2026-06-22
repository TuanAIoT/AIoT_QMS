import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ApiResponse,
  type AuthExchangeResponse,
  type Booking,
  type BookingStatusView,
  type CancellationResponse,
  type CheckInTokenResponse,
  createMockCentralServer,
  DEFAULT_MOCK_ZALO_TOKENS,
  MOCK_LOCATIONS,
  MOCK_SERVICES,
  type MockCentralServer,
  type PaginationResponse,
} from '../src/index.js';

const RESET_CREDENTIAL = 'test-reset-control-credential';
const FIXED_NOW = new Date('2026-06-22T08:30:00.000Z');

function requireSeed<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Required mock seed is missing: ${label}.`);
  }
  return value;
}

const LOCATION_A = requireSeed(MOCK_LOCATIONS[0], 'location A');
const SERVICE_A = requireSeed(MOCK_SERVICES[0], 'service A');
const SERVICE_B = requireSeed(MOCK_SERVICES[1], 'service B');

interface HttpResult<T> {
  readonly status: number;
  readonly body: ApiResponse<T>;
  readonly headers: Headers;
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly token?: string;
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly idempotencyKey?: string;
  readonly resetCredential?: string;
  readonly origin?: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

let server: MockCentralServer;
let baseUrl: string;
let sessionA: string;
let sessionB: string;

function getData<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(`Expected success but received ${response.error.code}.`);
  }
  return response.data;
}

function getHttpData<T>(result: HttpResult<T>): T {
  return getData(result.body);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<HttpResult<T>> {
  const headers = new Headers({ Accept: 'application/json', ...options.extraHeaders });
  const serializedBody =
    options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  if (serializedBody !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token !== undefined) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.idempotencyKey !== undefined) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }
  if (options.resetCredential !== undefined) {
    headers.set('X-Dev-Reset-Credential', options.resetCredential);
  }
  if (options.origin !== undefined) {
    headers.set('Origin', options.origin);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiResponse<T>,
    headers: response.headers,
  };
}

async function exchange(zaloAccessToken: string): Promise<AuthExchangeResponse> {
  const result = await request<AuthExchangeResponse>('/zalo/auth/exchange', {
    method: 'POST',
    body: { zaloAccessToken },
  });
  expect(result.status).toBe(200);
  return getData(result.body);
}

function bookingRequest(serviceId = SERVICE_A.serviceId): {
  readonly locationId: string;
  readonly serviceId: string;
  readonly requestedStartAt: string;
} {
  return {
    locationId: LOCATION_A.locationId,
    serviceId,
    requestedStartAt: '2026-06-23T02:00:00.000Z',
  };
}

async function createBooking(
  token: string,
  key: string,
  body = bookingRequest(),
): Promise<HttpResult<Booking>> {
  return request('/bookings', {
    method: 'POST',
    token,
    idempotencyKey: key,
    body,
  });
}

beforeAll(async () => {
  server = createMockCentralServer({
    now: () => new Date(FIXED_NOW),
    resetCredential: RESET_CREDENTIAL,
    corsOrigins: ['http://127.0.0.1:5173'],
  });
  const port = await server.listen();
  baseUrl = `http://127.0.0.1:${String(port)}/api/v1`;
  sessionA = (await exchange(DEFAULT_MOCK_ZALO_TOKENS.userA)).accessToken;
  sessionB = (await exchange(DEFAULT_MOCK_ZALO_TOKENS.userB)).accessToken;
});

beforeEach(() => {
  server.state.resetNamespace(server.state.authenticate(sessionA));
  server.state.resetNamespace(server.state.authenticate(sessionB));
});

afterAll(async () => {
  await server.close();
});

describe('Mock Central Server DEVELOPMENT_ONLY', () => {
  it('exchanges only configured mock Zalo tokens', async () => {
    const accepted = await exchange(DEFAULT_MOCK_ZALO_TOKENS.userA);
    const rejected = await request<AuthExchangeResponse>('/zalo/auth/exchange', {
      method: 'POST',
      body: { zaloAccessToken: 'unknown-development-token' },
    });

    expect(accepted.sessionId).toBe('session-demo-a-6k2p');
    expect(accepted.expiresAt).toBe('2026-06-22T08:45:00.000Z');
    expect(rejected.status).toBe(401);
    expect(rejected.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Mock Zalo token is not accepted.' },
    });
  });

  it('keeps two server-bound namespaces isolated', async () => {
    const created = getHttpData(await createBooking(sessionA, 'create-isolation-a')).bookingId;
    const hidden = await request<Booking>(`/bookings/${created}`, {
      token: sessionB,
      extraHeaders: { 'X-Dev-Test-Client': 'namespace-demo-a' },
    });
    const owner = await request<Booking>(`/bookings/${created}`, { token: sessionA });

    expect(hidden.status).toBe(400);
    expect(hidden.body).toMatchObject({
      success: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(owner.status).toBe(200);
  });

  it('returns deterministic Vietnamese locations and services', async () => {
    const locations = await request<PaginationResponse<(typeof MOCK_LOCATIONS)[number]>>(
      '/locations',
      { token: sessionA },
    );
    const services = await request<PaginationResponse<(typeof MOCK_SERVICES)[number]>>(
      `/locations/${LOCATION_A.locationId}/services`,
      { token: sessionA },
    );

    expect(getData(locations.body).items).toEqual(MOCK_LOCATIONS);
    expect(getData(services.body).items).toEqual(MOCK_SERVICES.slice(0, 2));
    expect(JSON.stringify([locations.body, services.body])).toContain('Điểm phục vụ Demo Bắc');
  });

  it('creates a booking with an opaque ID and separate Central status', async () => {
    const result = await createBooking(sessionA, 'create-booking-001');
    const booking = getData(result.body);

    expect(result.status).toBe(201);
    expect(booking).toMatchObject({
      locationId: LOCATION_A.locationId,
      serviceId: SERVICE_A.serviceId,
      status: 'CONFIRMED',
      canCancel: true,
    });
    expect(booking.bookingId).toMatch(/^bkg_[A-Za-z0-9_-]{16}$/);
    expect(booking).not.toHaveProperty('ticketId');
  });

  it('returns the original booking for an idempotent retry', async () => {
    const first = await createBooking(sessionA, 'create-booking-retry');
    const retry = await createBooking(sessionA, 'create-booking-retry');

    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
  });

  it('rejects an idempotency key reused with another valid payload', async () => {
    await createBooking(sessionA, 'create-booking-conflict');
    const conflict = await createBooking(
      sessionA,
      'create-booking-conflict',
      bookingRequest(SERVICE_B.serviceId),
    );

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      success: false,
      error: { code: 'IDEMPOTENCY_CONFLICT' },
    });
  });

  it('enforces booking ownership without revealing another namespace', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'owner-create'));
    const result = await request<Booking>(`/bookings/${booking.bookingId}`, { token: sessionB });

    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('returns booking detail and lightweight status', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'detail-create'));
    const detail = await request<Booking>(`/bookings/${booking.bookingId}`, { token: sessionA });
    const status = await request<BookingStatusView>(`/bookings/${booking.bookingId}/status`, {
      token: sessionA,
    });

    expect(getData(detail.body)).toEqual(booking);
    expect(getData(status.body)).toEqual({
      bookingId: booking.bookingId,
      status: 'CONFIRMED',
      updatedAt: '2026-06-22T08:30:00.000Z',
      stale: false,
    });
  });

  it('cancels idempotently and returns the original response', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'cancel-create'));
    const options: RequestOptions = {
      method: 'POST',
      token: sessionA,
      idempotencyKey: 'cancel-booking-001',
      body: {},
    };
    const first = await request<CancellationResponse>(
      `/bookings/${booking.bookingId}/cancel`,
      options,
    );
    const retry = await request<CancellationResponse>(
      `/bookings/${booking.bookingId}/cancel`,
      options,
    );

    expect(first.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    expect(getData(first.body).status).toBe('CANCELLED');
  });

  it('does not transition a terminal booking with a new command', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'terminal-create'));
    await request(`/bookings/${booking.bookingId}/cancel`, {
      method: 'POST',
      token: sessionA,
      idempotencyKey: 'terminal-cancel',
      body: {},
    });
    const qr = await request<CheckInTokenResponse>(
      `/bookings/${booking.bookingId}/check-in-token`,
      {
        method: 'POST',
        token: sessionA,
        idempotencyKey: 'terminal-qr-key',
        body: {},
      },
    );
    const cancelAgain = await request<CancellationResponse>(
      `/bookings/${booking.bookingId}/cancel`,
      {
        method: 'POST',
        token: sessionA,
        idempotencyKey: 'terminal-cancel-new',
        body: {},
      },
    );

    expect(qr.status).toBe(409);
    expect(cancelAgain.status).toBe(409);
  });

  it('issues an opaque 256-bit check-in token without PII', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'qr-create'));
    const result = await request<CheckInTokenResponse>(
      `/bookings/${booking.bookingId}/check-in-token`,
      {
        method: 'POST',
        token: sessionA,
        idempotencyKey: 'qr-issue-001',
        body: {},
      },
    );
    const data = getData(result.body);

    expect(result.status).toBe(201);
    expect(data.checkInToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.checkInToken).not.toContain(booking.bookingId);
    expect(JSON.stringify(data)).not.toMatch(/cccd|phone|email|fullName|zaloAccessToken/i);
    expect(server.state.isCheckInTokenActive(data.checkInToken)).toBe(true);
  });

  it('returns the exact original QR token for the same idempotency key', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'qr-retry-create'));
    const options: RequestOptions = {
      method: 'POST',
      token: sessionA,
      idempotencyKey: 'qr-retry-key',
      body: {},
    };
    const first = await request<CheckInTokenResponse>(
      `/bookings/${booking.bookingId}/check-in-token`,
      options,
    );
    const retry = await request<CheckInTokenResponse>(
      `/bookings/${booking.bookingId}/check-in-token`,
      options,
    );

    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
  });

  it('rotates with a new key and invalidates the previous QR token', async () => {
    const booking = getHttpData(await createBooking(sessionA, 'qr-rotate-create'));
    const first = getHttpData(
      await request<CheckInTokenResponse>(`/bookings/${booking.bookingId}/check-in-token`, {
        method: 'POST',
        token: sessionA,
        idempotencyKey: 'qr-rotate-first',
        body: {},
      }),
    );
    const second = getHttpData(
      await request<CheckInTokenResponse>(`/bookings/${booking.bookingId}/check-in-token`, {
        method: 'POST',
        token: sessionA,
        idempotencyKey: 'qr-rotate-second',
        body: {},
      }),
    );

    expect(second.checkInToken).not.toBe(first.checkInToken);
    expect(server.state.isCheckInTokenActive(first.checkInToken)).toBe(false);
    expect(server.state.isCheckInTokenActive(second.checkInToken)).toBe(true);
  });

  it('protects reset and resets only the authenticated namespace', async () => {
    const bookingA = getHttpData(await createBooking(sessionA, 'reset-create-a'));
    const bookingB = getHttpData(await createBooking(sessionB, 'reset-create-b'));
    const rejected = await request<{ readonly reset: boolean }>('/dev/zalo/reset', {
      method: 'POST',
      token: sessionA,
      resetCredential: 'wrong-development-credential',
      body: {},
    });
    const accepted = await request<{ readonly reset: boolean }>('/dev/zalo/reset', {
      method: 'POST',
      token: sessionA,
      resetCredential: RESET_CREDENTIAL,
      body: {},
    });
    const removed = await request<Booking>(`/bookings/${bookingA.bookingId}`, { token: sessionA });
    const retained = await request<Booking>(`/bookings/${bookingB.bookingId}`, { token: sessionB });

    expect(rejected.status).toBe(403);
    expect(accepted.status).toBe(200);
    expect(removed.status).toBe(404);
    expect(retained.status).toBe(200);
  });

  it('does not register the reset route in production mode', async () => {
    const productionServer = createMockCentralServer({
      nodeEnv: 'production',
      resetCredential: RESET_CREDENTIAL,
    });
    const port = await productionServer.listen();
    try {
      const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/dev/zalo/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = (await response.json()) as ApiResponse<unknown>;
      expect(response.status).toBe(404);
      expect(body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    } finally {
      await productionServer.close();
    }
  });

  it('always returns the nested error envelope', async () => {
    const result = await request<unknown>('/locations', { token: 'unknown-central-session' });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Mock Central session is invalid.' },
    });
    expect(result.body).not.toHaveProperty('code');
  });

  it('does not log credentials, payloads, or PII', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await request('/zalo/auth/exchange', {
      method: 'POST',
      body: { zaloAccessToken: DEFAULT_MOCK_ZALO_TOKENS.userA },
    });
    await request('/bookings', {
      method: 'POST',
      token: sessionA,
      idempotencyKey: 'no-log-booking-key',
      body: bookingRequest(),
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('rejects unknown request fields and oversized bodies', async () => {
    const unknownField = await request('/bookings', {
      method: 'POST',
      token: sessionA,
      idempotencyKey: 'unknown-field-key',
      body: { ...bookingRequest(), unexpected: 'not-accepted' },
    });
    const oversized = await request('/bookings', {
      method: 'POST',
      token: sessionA,
      idempotencyKey: 'oversized-body-key',
      rawBody: JSON.stringify({ padding: 'x'.repeat(40_000) }),
    });

    expect(unknownField.status).toBe(400);
    expect(oversized.status).toBe(413);
  });

  it('allows only configured development CORS origins', async () => {
    const allowed = await request('/locations', {
      token: sessionA,
      origin: 'http://127.0.0.1:5173',
    });
    const denied = await request('/locations', {
      token: sessionA,
      origin: 'https://unconfigured.example',
    });

    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5173');
    expect(denied.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('contains no outbound Zalo, MQTT, WebSocket, or Local Server integration', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const source = ['server.ts', 'state.ts', 'main.ts']
      .map((file) => readFileSync(join(sourceRoot, file), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\bfetch\s*\(|WebSocket|mqtt\.js|zmp-sdk|mini\.zalo\.me/i);
    expect(source).not.toMatch(/127\.0\.0\.1:3001|localhost:3001/i);
  });
});
