import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

import { MockZaloQmsError, MockZaloQmsState } from './state.js';

const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_CORS_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173'] as const;
const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, X-Request-ID';

export interface MockZaloQmsServerOptions {
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

function requireOnlyServiceId(value: unknown): string {
  if (!isRecord(value)) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'Body phải là object.');
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'serviceId') {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'Body chỉ được chứa serviceId.');
  }
  if (typeof value.serviceId !== 'string' || value.serviceId.trim().length === 0) {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'serviceId không hợp lệ.');
  }
  return value.serviceId;
}

function decodeTicketId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new MockZaloQmsError(400, 'INVALID_REQUEST', 'ticketId không hợp lệ.');
  }
}

class NativeMockZaloQmsServer implements MockZaloQmsServer {
  readonly state = new MockZaloQmsState();
  private readonly httpServer: Server;
  private readonly corsOrigins: ReadonlySet<string>;

  constructor(options: MockZaloQmsServerOptions = {}) {
    this.corsOrigins = new Set(options.corsOrigins ?? DEFAULT_CORS_ORIGINS);
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
    this.applyHeaders(request, response);
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

      if (method === 'GET' && url.pathname === '/api/zalo/services') {
        this.sendSuccess(response, this.state.listServices());
        return;
      }

      if (method === 'POST' && url.pathname === '/api/zalo/tickets') {
        const ticket = this.state.createTicket(requireOnlyServiceId(await readJson(request)));
        this.sendSuccess(response, ticket, 201);
        return;
      }

      const ticketMatch = url.pathname.match(/^\/api\/zalo\/tickets\/([^/]+)$/);
      if (method === 'GET' && ticketMatch?.[1] !== undefined) {
        this.sendSuccess(response, this.state.getTicket(decodeTicketId(ticketMatch[1])));
        return;
      }

      if (method === 'POST' && url.pathname === '/api/zalo/dev/reset') {
        this.state.reset();
        this.sendSuccess(response, { reset: true });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/zalo/dev/call-next') {
        this.sendSuccess(response, { ticket: this.state.callNext() });
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

  private applyHeaders(request: IncomingMessage, response: ServerResponse): void {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && this.corsOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }
    response.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
    response.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    response.setHeader('Vary', 'Origin');
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
