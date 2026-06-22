import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { PaginationResponse } from './models.js';
import {
  MockCentralState,
  MockCentralStateError,
  type MockCentralStateOptions,
  type MockPrincipal,
} from './state.js';

const API_BASE_PATH = '/api/v1';
const MAX_BODY_BYTES = 32 * 1_024;
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'] as const;
const CORS_ALLOW_METHODS = 'GET, POST, OPTIONS';
const CORS_ALLOW_HEADERS =
  'Content-Type, Authorization, Idempotency-Key, X-Request-ID, X-Dev-Reset-Credential';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{8,128}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiFailure {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface MockCentralServerOptions extends MockCentralStateOptions {
  readonly corsOrigins?: readonly string[];
  readonly nodeEnv?: string;
  readonly resetCredential?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExactObject(
  value: unknown,
  requiredFields: readonly string[],
  optionalFields: readonly string[] = [],
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  }
  const allowed = new Set([...requiredFields, ...optionalFields]);
  const unknownField = Object.keys(value).find((key) => !allowed.has(key));
  if (unknownField !== undefined) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Request contains an unknown field.');
  }
  const missingField = requiredFields.find((key) => !(key in value));
  if (missingField !== undefined) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Required field is missing.', {
      field: missingField,
    });
  }
  return value;
}

function requireNonEmptyString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Field must be a non-empty string.', {
      field: key,
    });
  }
  return value;
}

function requireOpaqueId(record: Record<string, unknown>, key: string): string {
  const value = requireNonEmptyString(record, key);
  if (!ID_PATTERN.test(value)) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Identifier format is invalid.', {
      field: key,
    });
  }
  return value;
}

function requireUtcTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireNonEmptyString(record, key);
  const parsed = new Date(value);
  if (
    !UTC_TIMESTAMP_PATTERN.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    throw new MockCentralStateError(
      422,
      'VALIDATION_FAILED',
      'Timestamp must be a real UTC ISO-8601 value.',
      { field: key },
    );
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
      throw new MockCentralStateError(
        413,
        'REQUEST_TOO_LARGE',
        'Request body exceeds the development mock limit.',
      );
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
    throw new MockCentralStateError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
  }
}

function requireNoQuery(url: URL): void {
  if ([...url.searchParams.keys()].length > 0) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Query parameters are not allowed.');
  }
}

function rejectTokenQuery(url: URL): void {
  if ([...url.searchParams.keys()].some((key) => /token|secret|credential/i.test(key))) {
    throw new MockCentralStateError(
      400,
      'INVALID_REQUEST',
      'Credentials are not accepted in query parameters.',
    );
  }
}

function requireAllowedQuery(url: URL, allowedFields: readonly string[]): void {
  const allowed = new Set(allowedFields);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Unknown query parameter.');
  }
}

function parsePagination(url: URL): { readonly page: number; readonly pageSize: number } {
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new MockCentralStateError(
      400,
      'INVALID_REQUEST',
      'page must be positive and pageSize must be from 1 to 100.',
    );
  }
  return { page, pageSize };
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): PaginationResponse<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalItems: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function bearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization === undefined || !authorization.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authorization.slice('Bearer '.length);
  return token.length === 0 ? undefined : token;
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function pathIdentifier(value: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Path identifier is invalid.');
  }
  if (!ID_PATTERN.test(decoded)) {
    throw new MockCentralStateError(400, 'INVALID_REQUEST', 'Path identifier is invalid.');
  }
  return decoded;
}

export class MockCentralServer {
  readonly state: MockCentralState;
  private readonly httpServer: Server;
  private readonly corsOrigins: ReadonlySet<string>;
  private readonly isProduction: boolean;
  private readonly resetCredential: string | undefined;

  constructor(options: MockCentralServerOptions = {}) {
    this.state = new MockCentralState(options);
    this.corsOrigins = new Set(options.corsOrigins ?? DEFAULT_CORS_ORIGINS);
    this.isProduction = (options.nodeEnv ?? 'development') === 'production';
    this.resetCredential = options.resetCredential;
    if (this.resetCredential !== undefined && this.resetCredential.trim().length < 16) {
      throw new TypeError('Development reset credential must contain at least 16 characters.');
    }
    this.httpServer = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  listen(port = 0, host = '127.0.0.1'): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(port, host, () => {
        this.httpServer.off('error', reject);
        const address = this.httpServer.address() as AddressInfo | null;
        if (address === null) {
          reject(new Error('Mock Central Server did not expose a listening address.'));
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
    this.applyResponseHeaders(request, response);
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', 'http://mock.central');
      rejectTokenQuery(url);
      const path = url.pathname;

      if (method === 'POST' && path === `${API_BASE_PATH}/zalo/auth/exchange`) {
        requireNoQuery(url);
        await this.exchange(request, response);
        return;
      }

      if (path === `${API_BASE_PATH}/dev/zalo/reset` && this.isProduction) {
        this.sendError(response, 404, 'RESOURCE_NOT_FOUND', 'Mock endpoint was not found.');
        return;
      }

      const principal = this.state.authenticate(bearerToken(request));
      if (request.headers['x-dev-test-client'] !== undefined) {
        throw new MockCentralStateError(
          400,
          'INVALID_REQUEST',
          'Client-selected namespaces are not supported.',
        );
      }

      if (method === 'GET' && path === `${API_BASE_PATH}/locations`) {
        requireAllowedQuery(url, ['page', 'pageSize']);
        const pagination = parsePagination(url);
        this.sendSuccess(
          response,
          paginate(this.state.locations, pagination.page, pagination.pageSize),
        );
        return;
      }

      const servicesMatch = path.match(/^\/api\/v1\/locations\/([^/]+)\/services$/);
      if (method === 'GET' && servicesMatch?.[1] !== undefined) {
        requireAllowedQuery(url, ['page', 'pageSize']);
        const pagination = parsePagination(url);
        const services = this.state.listServices(pathIdentifier(servicesMatch[1]));
        this.sendSuccess(response, paginate(services, pagination.page, pagination.pageSize));
        return;
      }

      if (method === 'POST' && path === `${API_BASE_PATH}/bookings`) {
        requireNoQuery(url);
        await this.createBooking(request, response, principal);
        return;
      }

      const bookingMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)$/);
      if (method === 'GET' && bookingMatch?.[1] !== undefined) {
        requireNoQuery(url);
        this.sendSuccess(
          response,
          this.state.getBooking(principal, pathIdentifier(bookingMatch[1])),
        );
        return;
      }

      const statusMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)\/status$/);
      if (method === 'GET' && statusMatch?.[1] !== undefined) {
        requireNoQuery(url);
        this.sendSuccess(
          response,
          this.state.getBookingStatus(principal, pathIdentifier(statusMatch[1])),
        );
        return;
      }

      const checkInTokenMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)\/check-in-token$/);
      if (method === 'POST' && checkInTokenMatch?.[1] !== undefined) {
        requireNoQuery(url);
        const body = requireExactObject(await readJson(request), []);
        const result = this.state.createCheckInToken(
          principal,
          pathIdentifier(checkInTokenMatch[1]),
          this.requireIdempotencyKey(request),
          body,
        );
        this.sendSuccess(response, result.data, result.status);
        return;
      }

      const cancelMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelMatch?.[1] !== undefined) {
        requireNoQuery(url);
        const body = requireExactObject(await readJson(request), []);
        const result = this.state.cancelBooking(
          principal,
          pathIdentifier(cancelMatch[1]),
          this.requireIdempotencyKey(request),
          body,
        );
        this.sendSuccess(response, result.data, result.status);
        return;
      }

      if (!this.isProduction && method === 'POST' && path === `${API_BASE_PATH}/dev/zalo/reset`) {
        requireNoQuery(url);
        requireExactObject(await readJson(request), []);
        const providedCredential = request.headers['x-dev-reset-credential'];
        if (
          this.resetCredential === undefined ||
          typeof providedCredential !== 'string' ||
          !safeEqual(providedCredential, this.resetCredential)
        ) {
          throw new MockCentralStateError(
            403,
            'FORBIDDEN',
            'Development reset credential is invalid.',
          );
        }
        this.state.resetNamespace(principal);
        this.sendSuccess(response, { reset: true });
        return;
      }

      this.sendError(response, 404, 'RESOURCE_NOT_FOUND', 'Mock endpoint was not found.');
    } catch (error) {
      if (error instanceof MockCentralStateError) {
        this.sendError(response, error.status, error.code, error.message, error.details);
        return;
      }
      this.sendError(response, 500, 'INTERNAL_ERROR', 'Mock request failed.');
    }
  }

  private async exchange(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = requireExactObject(await readJson(request), ['zaloAccessToken']);
    const data = this.state.exchange(requireNonEmptyString(body, 'zaloAccessToken'));
    this.sendSuccess(response, data);
  }

  private async createBooking(
    request: IncomingMessage,
    response: ServerResponse,
    principal: MockPrincipal,
  ): Promise<void> {
    const body = requireExactObject(await readJson(request), [
      'locationId',
      'serviceId',
      'requestedStartAt',
    ]);
    const result = this.state.createBooking(principal, this.requireIdempotencyKey(request), {
      locationId: requireOpaqueId(body, 'locationId'),
      serviceId: requireOpaqueId(body, 'serviceId'),
      requestedStartAt: requireUtcTimestamp(body, 'requestedStartAt'),
    });
    this.sendSuccess(response, result.data, result.status);
  }

  private requireIdempotencyKey(request: IncomingMessage): string {
    const value = request.headers['idempotency-key'];
    if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
      throw new MockCentralStateError(
        400,
        'INVALID_REQUEST',
        'A valid Idempotency-Key header is required.',
      );
    }
    return value;
  }

  private applyResponseHeaders(request: IncomingMessage, response: ServerResponse): void {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && this.corsOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }
    response.setHeader('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
    response.setHeader('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-QMS-Mock', 'development-only');
    const suppliedRequestId = request.headers['x-request-id'];
    response.setHeader(
      'X-Request-ID',
      typeof suppliedRequestId === 'string' && ID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID(),
    );
  }

  private sendSuccess<T>(response: ServerResponse, data: T, status = 200): void {
    this.sendJson(response, status, { success: true, data });
  }

  private sendError(
    response: ServerResponse,
    status: number,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.sendJson(response, status, {
      success: false,
      error: { code, message, ...(details === undefined ? {} : { details }) },
    });
  }

  private sendJson<T>(response: ServerResponse, status: number, body: ApiResponse<T>): void {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
  }
}

export function createMockCentralServer(options?: MockCentralServerOptions): MockCentralServer {
  return new MockCentralServer(options);
}
