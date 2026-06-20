import type {
  ApiError,
  ApiResponse,
  AssistedTicketRequest,
  CallNextRequest,
  Counter,
  DashboardSummaryResponse,
  EndCounterSessionRequest,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  PriorityLevel,
  RecallRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  StartCounterSessionRequest,
  TransferRequest,
  User,
} from '@qms/contracts';
import { DEMO_LOCATION } from '@qms/seed-data';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { DevEventPipeline } from './dev-events.js';
import { MockLocalState, MockStateError } from './state.js';

const API_BASE_PATH = '/api/v1';
const MOCK_USERNAME = 'demo';
const MOCK_PASSWORD = 'demo-password';
const MOCK_ACCESS_TOKEN = 'mock-local-access-token';
const MOCK_REFRESH_TOKEN = 'mock-local-refresh-token';
const MAX_BODY_BYTES = 1_000_000;
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'] as const;
const CORS_ALLOW_METHODS = 'GET, POST, OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type, Authorization';

const MOCK_USER: User = {
  id: 'user-demo-local-001',
  username: MOCK_USERNAME,
  displayName: 'Development Demo User',
  locationId: DEMO_LOCATION.id,
  roles: ['TELLER'],
  isActive: true,
};

export interface MockLocalServerOptions {
  readonly delayMs?: number;
  readonly corsOrigin?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  return typeof field === 'string' && field.trim().length > 0;
}

function requireObject(value: unknown, requiredFields: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || !requiredFields.every((field) => hasNonEmptyString(value, field))) {
    throw new MockStateError(400, 'INVALID_REQUEST', 'Required request fields are missing.');
  }
  return value;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new MockStateError(400, 'REQUEST_TOO_LARGE', 'The request body is too large.');
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim().length === 0) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MockStateError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
}

function sendJson<T>(response: ServerResponse, status: number, body: ApiResponse<T>): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendSuccess<T>(response: ServerResponse, data: T, status = 200): void {
  sendJson(response, status, { success: true, data });
}

function sendError(response: ServerResponse, status: number, error: ApiError): void {
  sendJson<never>(response, status, { success: false, error });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function asString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new MockStateError(400, 'INVALID_REQUEST', `Field ${key} must be a string.`);
  }
  return value;
}

function asOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new MockStateError(400, 'INVALID_REQUEST', `Field ${key} must be a string.`);
  }
  return value;
}

function isPriorityLevel(value: unknown): value is PriorityLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}

function isAuthorized(request: IncomingMessage): boolean {
  return request.headers.authorization === `Bearer ${MOCK_ACCESS_TOKEN}`;
}

export class MockLocalServer {
  readonly state = new MockLocalState();
  readonly devEvents = new DevEventPipeline(this.state);
  private readonly httpServer: Server;
  private readonly delayMs: number;
  private readonly corsOrigins: ReadonlySet<string>;

  constructor(options: MockLocalServerOptions = {}) {
    this.delayMs = options.delayMs ?? 0;
    if (!Number.isInteger(this.delayMs) || this.delayMs < 0) {
      throw new TypeError('Mock server delayMs must be a non-negative integer.');
    }
    this.corsOrigins = new Set(
      options.corsOrigin === undefined ? DEFAULT_CORS_ORIGINS : [options.corsOrigin],
    );
    this.httpServer = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  resetState(): void {
    this.state.reset();
    this.devEvents.reset();
  }

  listen(port = 0, host = '127.0.0.1'): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(port, host, () => {
        this.httpServer.off('error', reject);
        const address = this.httpServer.address() as AddressInfo | null;
        if (address === null) {
          reject(new Error('Mock Local Server did not expose a listening address.'));
          return;
        }
        resolve(address.port);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      this.applyCorsHeaders(request, response);
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }

      if (this.delayMs > 0) {
        await delay(this.delayMs);
      }

      const url = new URL(request.url ?? '/', 'http://mock.local');
      const path = url.pathname;
      const method = request.method ?? 'GET';

      if (method === 'POST' && path === `${API_BASE_PATH}/auth/login`) {
        await this.login(request, response);
        return;
      }
      if (method === 'POST' && path === `${API_BASE_PATH}/auth/refresh`) {
        await this.refresh(request, response);
        return;
      }
      if (!isAuthorized(request)) {
        sendError(response, 401, {
          code: 'UNAUTHORIZED',
          message: 'A mock access token is required.',
        });
        return;
      }

      if (method === 'POST' && path === `${API_BASE_PATH}/auth/logout`) {
        await readJson(request);
        // DEVELOPMENT_ONLY / BACKEND_CONFIRMATION_REQUIRED: Logout acknowledges the request,
        // but the fixed mock token remains valid because token invalidation is not implemented.
        sendSuccess<LogoutResponse>(response, { loggedOut: true });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/counter-session/start`) {
        const body = requireObject(await readJson(request), ['locationId', 'counterId', 'staffId']);
        const session = this.state.startCounterSession({
          locationId: asString(body, 'locationId'),
          counterId: asString(body, 'counterId'),
          staffId: asString(body, 'staffId'),
          ...(typeof body.resetTicketNumber === 'boolean'
            ? { resetTicketNumber: body.resetTicketNumber }
            : {}),
        } satisfies StartCounterSessionRequest);
        sendSuccess(response, { session }, 201);
      } else if (method === 'GET' && path === `${API_BASE_PATH}/counter-session/active`) {
        const locationId = url.searchParams.get('locationId');
        const counterId = url.searchParams.get('counterId');
        if (locationId === null || counterId === null) {
          throw new MockStateError(400, 'INVALID_QUERY', 'locationId and counterId are required.');
        }
        sendSuccess(response, {
          session: this.state.getActiveCounterSession(locationId, counterId),
        });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/counter-session/end`) {
        const body = requireObject(await readJson(request), ['locationId', 'sessionId']);
        const requestBody: EndCounterSessionRequest = {
          locationId: asString(body, 'locationId'),
          sessionId: asString(body, 'sessionId'),
        };
        sendSuccess(response, {
          session: this.state.endCounterSession(requestBody.locationId, requestBody.sessionId),
        });
      } else if (method === 'GET' && path === `${API_BASE_PATH}/queue/waiting`) {
        this.getWaitingQueue(url, response);
      } else if (method === 'GET' && path === `${API_BASE_PATH}/dev/events`) {
        this.getDevEvents(url, response);
      } else if (method === 'POST' && path === `${API_BASE_PATH}/dev/events/reset`) {
        await readJson(request);
        this.devEvents.reset();
        sendSuccess(response, { reset: true, lastSequence: 0 });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/queue/call-next`) {
        const body = requireObject(await readJson(request), [
          'locationId',
          'counterId',
          'sessionId',
        ]);
        const command: CallNextRequest = {
          locationId: asString(body, 'locationId'),
          counterId: asString(body, 'counterId'),
          sessionId: asString(body, 'sessionId'),
        };
        const counter = this.requireCounter(command.counterId, command.locationId);
        const ticket = this.state.callNext(command);
        if (ticket !== null) {
          this.devEvents.recordCall(ticket, counter);
        }
        sendSuccess(response, {
          ticket,
          summary: this.state.getQueueSummary(command.locationId),
        });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/queue/recall`) {
        const command = await this.readTicketCommand(request);
        const counter = this.requireCounter(command.counterId, command.locationId);
        const ticket = this.state.recall(command);
        this.devEvents.recordRecall(ticket, counter);
        sendSuccess(response, { ticket });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/queue/skip`) {
        const command = await this.readTicketCommand(request);
        sendSuccess(response, {
          ticket: this.state.skip(command),
          summary: this.state.getQueueSummary(command.locationId),
        });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/queue/transfer`) {
        await this.transfer(request, response);
      } else if (method === 'POST' && path === `${API_BASE_PATH}/queue/finish`) {
        const command = await this.readTicketCommand(request);
        const counter = this.requireCounter(command.counterId, command.locationId);
        const ticket = this.state.finish(command);
        this.devEvents.recordFinish(ticket, counter);
        sendSuccess(response, { ticket });
      } else if (method === 'POST' && path === `${API_BASE_PATH}/queue/ticket/assisted`) {
        await this.createAssistedTicket(request, response);
      } else if (method === 'GET' && path === `${API_BASE_PATH}/dashboard/summary`) {
        this.getDashboardSummary(url, response);
      } else {
        sendError(response, 404, { code: 'NOT_FOUND', message: 'Mock endpoint not found.' });
      }
    } catch (error) {
      if (error instanceof MockStateError) {
        sendError(response, error.status, { code: error.code, message: error.message });
        return;
      }
      sendError(response, 500, { code: 'MOCK_INTERNAL_ERROR', message: 'Mock request failed.' });
    }
  }

  private applyCorsHeaders(request: IncomingMessage, response: ServerResponse): void {
    const requestOrigin = request.headers.origin;
    const allowedOrigin =
      requestOrigin === undefined
        ? this.corsOrigins.values().next().value
        : this.corsOrigins.has(requestOrigin)
          ? requestOrigin
          : undefined;

    if (allowedOrigin !== undefined) {
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    response.setHeader('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
    response.setHeader('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
    response.setHeader('Vary', 'Origin');
  }

  private async login(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = requireObject(await readJson(request), ['username', 'password']);
    const credentials: LoginRequest = {
      username: asString(body, 'username'),
      password: asString(body, 'password'),
    };
    if (credentials.username !== MOCK_USERNAME || credentials.password !== MOCK_PASSWORD) {
      sendError(response, 401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid demo credentials.',
      });
      return;
    }

    // BACKEND_CONFIRMATION_REQUIRED: Development-only opaque tokens; these are not JWTs.
    const data: LoginResponse = {
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: MOCK_USER,
    };
    sendSuccess(response, data);
  }

  private async refresh(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = requireObject(await readJson(request), ['refreshToken']);
    const refreshRequest: RefreshTokenRequest = {
      refreshToken: asString(body, 'refreshToken'),
    };
    if (refreshRequest.refreshToken !== MOCK_REFRESH_TOKEN) {
      sendError(response, 401, {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid mock refresh token.',
      });
      return;
    }
    const data: RefreshTokenResponse = {
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    sendSuccess(response, data);
  }

  private getWaitingQueue(url: URL, response: ServerResponse): void {
    const locationId = url.searchParams.get('locationId');
    if (locationId === null) {
      throw new MockStateError(400, 'INVALID_QUERY', 'locationId is required.');
    }
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '50');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
      throw new MockStateError(
        400,
        'INVALID_PAGINATION',
        'page and pageSize must be positive integers.',
      );
    }
    const items = this.state.getWaitingTickets(
      locationId,
      url.searchParams.get('counterId') ?? undefined,
      url.searchParams.get('serviceId') ?? undefined,
    );
    const start = (page - 1) * pageSize;
    sendSuccess(response, {
      queue: {
        items: items.slice(start, start + pageSize),
        totalItems: items.length,
        page,
        pageSize,
        totalPages: Math.ceil(items.length / pageSize),
      },
      summary: this.state.getQueueSummary(locationId),
    });
  }

  private async readTicketCommand(request: IncomingMessage): Promise<RecallRequest> {
    const body = requireObject(await readJson(request), [
      'locationId',
      'counterId',
      'sessionId',
      'ticketId',
    ]);
    // The three command contracts share these required fields. Additional optional fields are
    // intentionally ignored until Backend confirms their behavior.
    return {
      locationId: asString(body, 'locationId'),
      counterId: asString(body, 'counterId'),
      sessionId: asString(body, 'sessionId'),
      ticketId: asString(body, 'ticketId'),
    };
  }

  private async transfer(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = requireObject(await readJson(request), [
      'locationId',
      'ticketId',
      'fromCounterId',
      'toCounterId',
      'sessionId',
    ]);
    const nextServiceId = asOptionalString(body, 'nextServiceId');
    const command: TransferRequest = {
      locationId: asString(body, 'locationId'),
      ticketId: asString(body, 'ticketId'),
      fromCounterId: asString(body, 'fromCounterId'),
      toCounterId: asString(body, 'toCounterId'),
      sessionId: asString(body, 'sessionId'),
      ...(nextServiceId === undefined ? {} : { nextServiceId }),
    };
    const toCounter = this.requireCounter(command.toCounterId, command.locationId);
    const ticket = this.state.transfer(command);
    this.devEvents.recordTransfer(ticket, command.fromCounterId, toCounter);
    sendSuccess(response, { ticket });
  }

  private async createAssistedTicket(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const body = requireObject(await readJson(request), [
      'locationId',
      'serviceId',
      'staffId',
      'sessionId',
    ]);
    const counterId = asOptionalString(body, 'counterId');
    const priorityLevel = body.priorityLevel;
    if (priorityLevel !== undefined && !isPriorityLevel(priorityLevel)) {
      throw new MockStateError(
        400,
        'INVALID_PRIORITY',
        'priorityLevel must be an integer from 0 to 5.',
      );
    }
    const command: AssistedTicketRequest = {
      locationId: asString(body, 'locationId'),
      serviceId: asString(body, 'serviceId'),
      staffId: asString(body, 'staffId'),
      sessionId: asString(body, 'sessionId'),
      ...(counterId === undefined ? {} : { counterId }),
      ...(priorityLevel === undefined ? {} : { priorityLevel }),
    };
    sendSuccess(response, { ticket: this.state.createAssistedTicket(command) }, 201);
  }

  private getDashboardSummary(url: URL, response: ServerResponse): void {
    const locationId = url.searchParams.get('locationId');
    if (locationId === null) {
      throw new MockStateError(400, 'INVALID_QUERY', 'locationId is required.');
    }
    const updatedAt = new Date().toISOString();
    const data: DashboardSummaryResponse = {
      queue: this.state.getQueueSummary(locationId),
      counters: this.state.counters.filter((counter) => counter.locationId === locationId),
      devices: this.state.devices.filter((device) => device.locationId === locationId),
      updatedAt,
    };
    sendSuccess(response, data);
  }

  /** DEVELOPMENT_ONLY / BACKEND_CONFIRMATION_REQUIRED: In-memory event inspection only. */
  private getDevEvents(url: URL, response: ServerResponse): void {
    const afterValue = url.searchParams.get('after');
    const after = afterValue === null ? 0 : Number(afterValue);
    if (!Number.isInteger(after) || after < 0) {
      throw new MockStateError(400, 'INVALID_SEQUENCE', 'after must be a non-negative integer.');
    }
    sendSuccess(response, this.devEvents.snapshot(after));
  }

  private requireCounter(counterId: string, locationId: string): Counter {
    const counter = this.state.counters.find(
      (candidate) => candidate.id === counterId && candidate.locationId === locationId,
    );
    if (counter === undefined) {
      throw new MockStateError(404, 'COUNTER_NOT_FOUND', 'The counter was not found.');
    }
    return counter;
  }
}

export function createMockLocalServer(options?: MockLocalServerOptions): MockLocalServer {
  return new MockLocalServer(options);
}
