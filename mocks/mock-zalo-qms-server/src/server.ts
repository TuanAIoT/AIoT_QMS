import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

import { MockZaloQmsError, MockZaloQmsState } from './state.js';

const MAX_BODY_BYTES = 16 * 1024;
const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Authorization, X-Request-ID';

export interface MockZaloQmsServerOptions {
  /**
   * Reserved for future stricter CORS policies.
   * Development mock API currently allows all origins so Zalo WebView can call it.
   */
  readonly corsOrigins?: readonly string[];
}

export interface MockZaloQmsServer {
  readonly state: MockZaloQmsState;
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

interface ApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

interface ApiError {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const currentKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return currentKeys.length === expectedKeys.length && currentKeys.every((key, index) => key === expectedKeys[index]);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new MockZaloQmsError(413, 'REQUEST_TOO_LARGE', 'Request body quá lớn.');
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
    throw new MockZaloQmsError(400, 'INVALID_JSON', 'JSON không hợp lệ.');
  }
}

function requireCreateBookingBody(value: unknown): {
  readonly locationId: string;
  readonly areaId: string;
  readonly serviceId: string;
  readonly fullName: string;
  readonly bookingDate: string;
} {
  if (!isRecord(value) || !exactKeys(value, ['areaId', 'bookingDate', 'fullName', 'locationId', 'serviceId'])) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'Body chỉ được chứa locationId, areaId, serviceId, bookingDate và fullName.');
  }
  if (typeof value.locationId !== 'string' || value.locationId.trim().length === 0) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'locationId không hợp lệ.');
  }
  if (typeof value.areaId !== 'string' || value.areaId.trim().length === 0) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'areaId không hợp lệ.');
  }
  if (typeof value.serviceId !== 'string' || value.serviceId.trim().length === 0) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'serviceId không hợp lệ.');
  }
  if (typeof value.fullName !== 'string' || value.fullName.trim().length === 0) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'fullName không hợp lệ.');
  }
  if (typeof value.bookingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.bookingDate)) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'bookingDate không hợp lệ.');
  }
  const bookingDate = new Date(`${value.bookingDate}T00:00:00.000Z`);
  if (Number.isNaN(bookingDate.getTime()) || bookingDate.toISOString().slice(0, 10) !== value.bookingDate) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'bookingDate không hợp lệ.');
  }
  return {
    locationId: value.locationId,
    areaId: value.areaId,
    serviceId: value.serviceId,
    fullName: value.fullName,
    bookingDate: value.bookingDate,
  };
}

function requireOptionalLocationId(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value) || !exactKeys(value, ['locationId'])) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'Body chỉ được chứa locationId.');
  }
  if (typeof value.locationId !== 'string' || value.locationId.trim().length === 0) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'locationId không hợp lệ.');
  }
  return value.locationId;
}

function parseTicketStatus(value: string | null): 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | undefined {
  if (
    value === 'WAITING' ||
    value === 'CALLED' ||
    value === 'SERVING' ||
    value === 'COMPLETED' ||
    value === 'CANCELLED' ||
    value === 'EXPIRED'
  ) {
    return value;
  }
  return undefined;
}

function parseTicketId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'ticketId không hợp lệ.');
  }
}

class NativeMockZaloQmsServer implements MockZaloQmsServer {
  readonly state = new MockZaloQmsState();
  private readonly httpServer: Server;


  constructor(_options: MockZaloQmsServerOptions = {}) {
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
          reject(new Error('Mock Zalo QMS Server did not expose a listening address.'));
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
    this.applyHeaders(response);
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }

      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', 'http://mock.zalo.qms');

      if (method === 'GET' && url.pathname === '/health') {
        this.sendRawJson(response, 200, { ok: true });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/zalo/locations') {
        this.sendSuccess(response, this.state.listLocations());
        return;
      }

      const areasMatch = url.pathname.match(/^\/api\/zalo\/locations\/([^/]+)\/areas$/);
      if (method === 'GET' && areasMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.listAreas(parseTicketId(areasMatch[1])));
        return;
      }

      const locationMatch = url.pathname.match(/^\/api\/zalo\/locations\/([^/]+)$/);
      if (method === 'GET' && locationMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.getLocation(parseTicketId(locationMatch[1])));
        return;
      }

      const servicesMatch = url.pathname.match(/^\/api\/zalo\/locations\/([^/]+)\/services$/);
      if (method === 'GET' && servicesMatch?.[1] !== undefined) {
        this.sendSuccess(
          response,
          this.state.listServices(parseTicketId(servicesMatch[1]), url.searchParams.get('areaId') ?? undefined),
        );
        return;
      }

      if (method === 'GET' && url.pathname === '/api/zalo/services') {
        const locationId = url.searchParams.get('locationId');
        if (locationId === null) {
          this.sendError(response, 400, 'INVALID_REQUEST', 'locationId không hợp lệ.');
          return;
        }
        this.sendSuccess(response, this.state.listServices(locationId));
        return;
      }

      const queueStatusMatch = url.pathname.match(/^\/api\/zalo\/locations\/([^/]+)\/queue-status$/);
      if (method === 'GET' && queueStatusMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.getQueueStatus(parseTicketId(queueStatusMatch[1])));
        return;
      }

      if (method === 'GET' && url.pathname === '/api/zalo/bookings') {
        this.sendSuccess(
          response,
          this.state.listTickets(
            url.searchParams.get('locationId') ?? undefined,
            parseTicketStatus(url.searchParams.get('status')),
          ),
        );
        return;
      }

      if (method === 'GET' && url.pathname === '/api/zalo/tickets') {
        this.sendSuccess(
          response,
          this.state.listTickets(
            url.searchParams.get('locationId') ?? undefined,
            parseTicketStatus(url.searchParams.get('status')),
          ),
        );
        return;
      }

      if (method === 'POST' && url.pathname === '/api/zalo/bookings') {
        const body = requireCreateBookingBody(await readJson(request));
        const ticket = this.state.createBooking(body.locationId, body.areaId, body.serviceId, body.fullName, body.bookingDate);
        this.sendSuccess(response, ticket, 201);
        return;
      }

      const currentBookingMatch = url.pathname.match(/^\/api\/zalo\/locations\/([^/]+)\/bookings\/current$/);
      if (method === 'GET' && currentBookingMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.getCurrentBooking(parseTicketId(currentBookingMatch[1])));
        return;
      }

      const historyMatch = url.pathname.match(/^\/api\/zalo\/locations\/([^/]+)\/bookings\/history$/);
      if (method === 'GET' && historyMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.listHistory(parseTicketId(historyMatch[1])));
        return;
      }

      const ticketMatch = url.pathname.match(/^\/api\/zalo\/bookings\/([^/]+)$/);
      if (method === 'GET' && ticketMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.getTicket(parseTicketId(ticketMatch[1])));
        return;
      }

      const cancelMatch = url.pathname.match(/^\/api\/zalo\/bookings\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.cancelTicket(parseTicketId(cancelMatch[1])));
        return;
      }

      if (method === 'POST' && url.pathname === '/api/zalo/dev/reset') {
        this.state.reset();
        this.sendSuccess(response, { reset: true });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/zalo/dev/call-next') {
        const raw = await readJson(request);
        const locationId =
          isRecord(raw) && Object.keys(raw).length === 0 ? undefined : requireOptionalLocationId(raw);
        this.sendSuccess(response, { ticket: this.state.callNext(locationId) });
        return;
      }

      this.sendError(response, 404, 'NOT_FOUND', 'Không tìm thấy endpoint mock.');
    } catch (error) {
      if (error instanceof MockZaloQmsError) {
        this.sendError(response, error.status, error.code, error.message);
        return;
      }
      this.sendError(response, 500, 'INTERNAL_ERROR', 'Mock server gặp lỗi.');
    }
  }

  private applyHeaders(response: ServerResponse): void {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
    response.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Request-ID', randomUUID());
    response.setHeader('X-QMS-Mock', 'zalo-development-only');
  }

  private sendSuccess<T>(response: ServerResponse, data: T, status = 200): void {
    this.sendRawJson(response, status, { ok: true, data });
  }

  private sendError(response: ServerResponse, status: number, code: string, message: string): void {
    this.sendRawJson(response, status, { ok: false, error: { code, message } });
  }

  private sendRawJson<T>(response: ServerResponse, status: number, body: ApiResponse<T> | { ok: true }): void {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
  }
}

export function createMockZaloQmsServer(
  options?: MockZaloQmsServerOptions,
): MockZaloQmsServer {
  return new NativeMockZaloQmsServer(options);
}
