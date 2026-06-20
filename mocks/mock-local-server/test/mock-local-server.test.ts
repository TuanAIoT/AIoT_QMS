import type {
  ApiResponse,
  AudioPlayEvent,
  AssistedTicketResponse,
  CallNextResponse,
  FinishResponse,
  GetActiveCounterSessionResponse,
  GetWaitingQueueResponse,
  LoginResponse,
  RecallResponse,
  SkipResponse,
  StartCounterSessionResponse,
  TransferResponse,
} from '@qms/contracts';
import {
  isAudioPlayEvent,
  isDisplayUpdateEvent,
  isQueueCallEvent,
  isQueueFinishEvent,
  isQueueRecallEvent,
} from '@qms/contracts';
import {
  DEMO_ACTIVE_COUNTER_SESSION,
  DEMO_COUNTERS,
  DEMO_LOCATION,
  DEMO_SERVICES,
  DEMO_STAFF,
} from '@qms/seed-data';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createMockLocalServer,
  DEV_EVENT_TOPICS,
  type DevEventsResponse,
  type MockLocalServer,
} from '../src/index.js';

interface HttpResult<T> {
  readonly status: number;
  readonly body: ApiResponse<T>;
}

let server: MockLocalServer;
let baseUrl: string;
let accessToken: string;

function getData<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(`Expected success response, received ${response.error.code}.`);
  }
  return response.data;
}

async function request<T>(
  path: string,
  options: {
    readonly method?: 'GET' | 'POST';
    readonly body?: unknown;
    readonly origin?: string;
    readonly token?: string;
  } = {},
): Promise<HttpResult<T>> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token !== undefined) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.origin !== undefined) {
    headers.set('Origin', options.origin);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: (await response.json()) as ApiResponse<T> };
}

async function authorizedRequest<T>(
  path: string,
  options: { readonly method?: 'GET' | 'POST'; readonly body?: unknown } = {},
): Promise<HttpResult<T>> {
  return request(path, { ...options, token: accessToken });
}

async function callNext(): Promise<CallNextResponse> {
  const result = await authorizedRequest<CallNextResponse>('/queue/call-next', {
    method: 'POST',
    body: {
      locationId: DEMO_LOCATION.id,
      counterId: DEMO_COUNTERS[0].id,
      sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
    },
  });
  expect(result.status).toBe(200);
  return getData(result.body);
}

async function getDevEvents(after?: number): Promise<DevEventsResponse> {
  const result = await authorizedRequest<DevEventsResponse>(
    `/dev/events${after === undefined ? '' : `?after=${String(after)}`}`,
  );
  expect(result.status).toBe(200);
  return getData(result.body);
}

beforeAll(async () => {
  server = createMockLocalServer();
  const port = await server.listen();
  baseUrl = `http://127.0.0.1:${String(port)}/api/v1`;
  const login = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { username: 'demo', password: 'demo-password' },
  });
  accessToken = getData(login.body).accessToken;
});

beforeEach(() => {
  server.resetState();
});

afterAll(async () => {
  await server.close();
});

describe('Mock Local Server', () => {
  it('handles browser OPTIONS preflight without authorization', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('adds CORS headers to a normal login response', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
      body: JSON.stringify({ username: 'demo', password: 'demo-password' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5173');
  });

  it('keeps auth protection while adding CORS headers to a 401 response', async () => {
    const response = await fetch(`${baseUrl}/queue/waiting?locationId=${DEMO_LOCATION.id}`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('logs in with development demo credentials', async () => {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username: 'demo', password: 'demo-password' },
    });

    expect(result.status).toBe(200);
    expect(getData(result.body)).toMatchObject({
      accessToken: 'mock-local-access-token',
      refreshToken: 'mock-local-refresh-token',
    });
  });

  it('returns 401 for invalid demo credentials', async () => {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username: 'demo', password: 'wrong-password' },
    });

    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({
      success: false,
      error: { code: 'INVALID_CREDENTIALS' },
    });
  });

  it('starts a counter session', async () => {
    const result = await authorizedRequest<StartCounterSessionResponse>('/counter-session/start', {
      method: 'POST',
      body: {
        locationId: DEMO_LOCATION.id,
        counterId: DEMO_COUNTERS[1].id,
        staffId: DEMO_STAFF[1].id,
      },
    });

    expect(result.status).toBe(201);
    expect(getData(result.body).session).toMatchObject({
      counterId: DEMO_COUNTERS[1].id,
      staffId: DEMO_STAFF[1].id,
      status: 'ACTIVE',
    });
  });

  it('gets the active counter session', async () => {
    const result = await authorizedRequest<GetActiveCounterSessionResponse>(
      `/counter-session/active?locationId=${DEMO_LOCATION.id}&counterId=${DEMO_COUNTERS[0].id}`,
    );

    expect(result.status).toBe(200);
    expect(getData(result.body).session?.id).toBe(DEMO_ACTIVE_COUNTER_SESSION.id);
  });

  it('gets the waiting queue', async () => {
    const result = await authorizedRequest<GetWaitingQueueResponse>(
      `/queue/waiting?locationId=${DEMO_LOCATION.id}`,
    );

    expect(result.status).toBe(200);
    expect(getData(result.body).queue.items).toEqual([
      expect.objectContaining({ id: 'ticket-demo-001', status: 'WAITING' }),
    ]);
  });

  it('calls the first waiting ticket', async () => {
    const data = await callNext();

    expect(data.ticket).toMatchObject({
      id: 'ticket-demo-001',
      status: 'CALLED',
      counterId: DEMO_COUNTERS[0].id,
    });
  });

  it('creates validated call, display, and audio dev events after call-next', async () => {
    await callNext();
    const log = await getDevEvents();

    expect(log.events.map((entry) => entry.topic)).toEqual([
      DEV_EVENT_TOPICS.queueCall,
      DEV_EVENT_TOPICS.displayUpdate,
      DEV_EVENT_TOPICS.audioPlay,
    ]);
    expect(isQueueCallEvent(log.events[0]?.event)).toBe(true);
    expect(isDisplayUpdateEvent(log.events[1]?.event)).toBe(true);
    expect(isAudioPlayEvent(log.events[2]?.event)).toBe(true);
    expect(log.lastSequence).toBe(3);
  });

  it('returns a successful null result when no waiting ticket remains', async () => {
    await callNext();
    const before = await getDevEvents();
    const data = await callNext();
    const after = await getDevEvents();

    expect(data.ticket).toBeNull();
    expect(after.events).toEqual(before.events);
    expect(after.events.filter((entry) => entry.topic === DEV_EVENT_TOPICS.audioPlay)).toHaveLength(
      1,
    );
  });

  it('recalls a called ticket without changing its primary state', async () => {
    const called = await callNext();
    if (called.ticket === null) {
      throw new Error('Expected a called ticket.');
    }
    const result = await authorizedRequest<RecallResponse>('/queue/recall', {
      method: 'POST',
      body: {
        locationId: DEMO_LOCATION.id,
        counterId: DEMO_COUNTERS[0].id,
        sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
        ticketId: called.ticket.id,
      },
    });

    expect(result.status).toBe(200);
    expect(getData(result.body).ticket.status).toBe('CALLED');
    const log = await getDevEvents(3);
    expect(log.events.map((entry) => entry.topic)).toEqual([
      DEV_EVENT_TOPICS.queueRecall,
      DEV_EVENT_TOPICS.audioPlay,
    ]);
    expect(isQueueRecallEvent(log.events[0]?.event)).toBe(true);
  });

  it('skips a called ticket', async () => {
    const called = await callNext();
    if (called.ticket === null) {
      throw new Error('Expected a called ticket.');
    }
    const result = await authorizedRequest<SkipResponse>('/queue/skip', {
      method: 'POST',
      body: {
        locationId: DEMO_LOCATION.id,
        counterId: DEMO_COUNTERS[0].id,
        sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
        ticketId: called.ticket.id,
      },
    });

    expect(result.status).toBe(200);
    expect(getData(result.body).ticket.status).toBe('SKIPPED');
  });

  it('creates transfer and display events after transferring a called ticket', async () => {
    const called = await callNext();
    if (called.ticket === null) {
      throw new Error('Expected a called ticket.');
    }
    const result = await authorizedRequest<TransferResponse>('/queue/transfer', {
      method: 'POST',
      body: {
        locationId: DEMO_LOCATION.id,
        ticketId: called.ticket.id,
        fromCounterId: DEMO_COUNTERS[0].id,
        toCounterId: DEMO_COUNTERS[1].id,
        sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
      },
    });
    const log = await getDevEvents(3);

    expect(result.status).toBe(200);
    expect(getData(result.body).ticket.status).toBe('TRANSFERRED');
    expect(log.events.map((entry) => entry.topic)).toEqual([
      DEV_EVENT_TOPICS.queueTransfer,
      DEV_EVENT_TOPICS.displayUpdate,
    ]);
  });

  it('finishes a called ticket', async () => {
    const called = await callNext();
    if (called.ticket === null) {
      throw new Error('Expected a called ticket.');
    }
    const result = await authorizedRequest<FinishResponse>('/queue/finish', {
      method: 'POST',
      body: {
        locationId: DEMO_LOCATION.id,
        counterId: DEMO_COUNTERS[0].id,
        sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
        ticketId: called.ticket.id,
      },
    });

    expect(result.status).toBe(200);
    expect(getData(result.body).ticket.status).toBe('FINISHED');
    const log = await getDevEvents(3);
    expect(log.events.map((entry) => entry.topic)).toEqual([
      DEV_EVENT_TOPICS.queueFinish,
      DEV_EVENT_TOPICS.displayUpdate,
    ]);
    expect(isQueueFinishEvent(log.events[0]?.event)).toBe(true);
  });

  it('returns only events newer than the requested sequence', async () => {
    await callNext();

    const log = await getDevEvents(1);

    expect(log.events.map((entry) => entry.sequence)).toEqual([2, 3]);
    expect(log.lastSequence).toBe(3);
  });

  it('resets the development event log through the dev-only endpoint', async () => {
    await callNext();

    const reset = await authorizedRequest<{
      readonly reset: boolean;
      readonly lastSequence: number;
    }>('/dev/events/reset', { method: 'POST', body: {} });
    const log = await getDevEvents();

    expect(reset.status).toBe(200);
    expect(getData(reset.body)).toEqual({ reset: true, lastSequence: 0 });
    expect(log).toEqual({ events: [], lastSequence: 0 });
  });

  it('keeps development events free of raw identity and contact fields', async () => {
    await callNext();
    const log = await getDevEvents();
    const serialized = JSON.stringify(log);

    expect(serialized).not.toMatch(
      /"(?:cccd|cccdNumber|citizenIdNumber|identityNumber|citizenHash|cccdScanned|faceVerified|customerName|phone|email|address)"/i,
    );
  });

  it('creates an audio announcement from safe public fields only', async () => {
    await callNext();
    const log = await getDevEvents();
    const audioEntry = log.events.find((entry) => entry.topic === DEV_EVENT_TOPICS.audioPlay);

    expect(isAudioPlayEvent(audioEntry?.event)).toBe(true);
    if (!isAudioPlayEvent(audioEntry?.event)) {
      throw new Error('Expected a validated AudioPlayEvent.');
    }
    const audioEvent: AudioPlayEvent = audioEntry.event;
    expect(audioEvent.payload.announcementText).toBe('Mời số A001 đến quầy Demo 01');
    expect(audioEvent.payload.announcementText).not.toMatch(
      /cccd|cmnd|@|(?:\+?84|0)\d{9,10}|\b\d{12}\b/i,
    );
  });

  it('does not store an event that fails its contract validator', async () => {
    const invalidEvent = {
      eventId: 'invalid-audio-event',
      eventType: 'AUDIO_PLAY',
      locationId: DEMO_LOCATION.id,
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        ticketNumber: 'A001',
        counterName: 'Quầy Demo 01',
        outputMode: 'SERVER_SPEAKER',
        announcementText: 'Mời số A001 đến quầy Demo 01',
        cccd: 'must-be-rejected',
      },
    };

    expect(server.devEvents.publish(DEV_EVENT_TOPICS.audioPlay, invalidEvent)).toBe(
      'INVALID_EVENT',
    );
    expect(await getDevEvents()).toEqual({ events: [], lastSequence: 0 });
  });

  it('creates an assisted STAFF ticket', async () => {
    const result = await authorizedRequest<AssistedTicketResponse>('/queue/ticket/assisted', {
      method: 'POST',
      body: {
        locationId: DEMO_LOCATION.id,
        serviceId: DEMO_SERVICES[0].id,
        staffId: DEMO_STAFF[0].id,
        sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
      },
    });

    expect(result.status).toBe(201);
    expect(getData(result.body).ticket).toMatchObject({ source: 'STAFF', status: 'WAITING' });
  });

  it('restores seed data when state is reset', async () => {
    await callNext();
    server.resetState();

    const result = await authorizedRequest<GetWaitingQueueResponse>(
      `/queue/waiting?locationId=${DEMO_LOCATION.id}`,
    );
    expect(getData(result.body).queue.items.map((ticket) => ticket.id)).toContain(
      'ticket-demo-001',
    );
  });

  it('does not expose raw CCCD fields in JSON responses', async () => {
    const responses = await Promise.all([
      authorizedRequest<GetWaitingQueueResponse>(`/queue/waiting?locationId=${DEMO_LOCATION.id}`),
      authorizedRequest<GetActiveCounterSessionResponse>(
        `/counter-session/active?locationId=${DEMO_LOCATION.id}&counterId=${DEMO_COUNTERS[0].id}`,
      ),
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { username: 'demo', password: 'demo-password' },
      }),
    ]);
    const serialized = JSON.stringify(responses);

    expect(serialized).not.toMatch(/"(?:cccd|cccdNumber|citizenIdNumber|identityNumber)"/i);
  });
});
