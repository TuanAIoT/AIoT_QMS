export interface QmsService {
  readonly id: 'medical' | 'payment' | 'consulting';
  readonly code: 'A' | 'B' | 'C';
  readonly name: string;
}

export type QmsTicketStatus = 'WAITING' | 'CALLED';

export interface QmsTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly serviceId: QmsService['id'];
  readonly serviceName: string;
  readonly status: QmsTicketStatus;
  readonly waitingAhead: number;
  readonly createdAt: string;
}

export interface QmsApiClient {
  getServices(signal?: AbortSignal): Promise<readonly QmsService[]>;
  createTicket(serviceId: QmsService['id'], signal?: AbortSignal): Promise<QmsTicket>;
  getTicket(ticketId: string, signal?: AbortSignal): Promise<QmsTicket>;
}

export class QmsApiError extends Error {
  constructor(
    readonly code: 'NETWORK_ERROR' | 'HTTP_ERROR' | 'INVALID_RESPONSE' | 'REQUEST_ABORTED',
    message: string,
  ) {
    super(message);
    this.name = 'QmsApiError';
  }
}

interface QmsApiOptions {
  readonly baseUrl: string;
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly signal?: AbortSignal | undefined;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function isService(value: unknown): value is QmsService {
  return (
    isRecord(value) &&
    (value.id === 'medical' || value.id === 'payment' || value.id === 'consulting') &&
    (value.code === 'A' || value.code === 'B' || value.code === 'C') &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0
  );
}

function isTicket(value: unknown): value is QmsTicket {
  if (!isRecord(value)) {
    return false;
  }
  const waitingAhead = value.waitingAhead;
  return (
    typeof value.ticketId === 'string' &&
    value.ticketId.trim().length > 0 &&
    typeof value.ticketNumber === 'string' &&
    value.ticketNumber.trim().length > 0 &&
    (value.serviceId === 'medical' ||
      value.serviceId === 'payment' ||
      value.serviceId === 'consulting') &&
    typeof value.serviceName === 'string' &&
    value.serviceName.trim().length > 0 &&
    (value.status === 'WAITING' || value.status === 'CALLED') &&
    typeof waitingAhead === 'number' &&
    Number.isInteger(waitingAhead) &&
    waitingAhead >= 0 &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

function parseEnvelope<T>(value: unknown, parseData: (data: unknown) => T): T {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    throw new QmsApiError('INVALID_RESPONSE', 'Phản hồi từ máy chủ thử nghiệm không hợp lệ.');
  }
  if (value.ok === false) {
    const message =
      isRecord(value.error) && typeof value.error.message === 'string'
        ? value.error.message
        : 'Yêu cầu chưa hoàn tất.';
    throw new QmsApiError('HTTP_ERROR', message);
  }
  if (!('data' in value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Phản hồi từ máy chủ thử nghiệm thiếu dữ liệu.');
  }
  return parseData(value.data);
}

function parseServices(value: unknown): readonly QmsService[] {
  if (!Array.isArray(value) || !value.every(isService)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Danh sách dịch vụ không hợp lệ.');
  }
  return value;
}

function parseTicket(value: unknown): QmsTicket {
  if (!isTicket(value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Thông tin vé không hợp lệ.');
  }
  return value;
}

export class HttpQmsApiClient implements QmsApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: QmsApiOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 8_000;
    if (this.baseUrl.trim().length === 0 || this.timeoutMs <= 0) {
      throw new QmsApiError('INVALID_RESPONSE', 'Cấu hình API thử nghiệm không hợp lệ.');
    }
  }

  getServices(signal?: AbortSignal): Promise<readonly QmsService[]> {
    return this.request('api/zalo/services', parseServices, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  createTicket(serviceId: QmsService['id'], signal?: AbortSignal): Promise<QmsTicket> {
    return this.request('api/zalo/tickets', parseTicket, {
      method: 'POST',
      body: { serviceId },
      ...(signal === undefined ? {} : { signal }),
    });
  }

  getTicket(ticketId: string, signal?: AbortSignal): Promise<QmsTicket> {
    return this.request(`api/zalo/tickets/${encodeURIComponent(ticketId)}`, parseTicket, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  private async request<T>(
    path: string,
    parseData: (data: unknown) => T,
    options: RequestOptions = {},
  ): Promise<T> {
    if (isAbortSignalAborted(options.signal)) {
      throw new QmsApiError('REQUEST_ABORTED', 'Yêu cầu đã được hủy.');
    }
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const requestInit: RequestInit = {
        method: options.method ?? 'GET',
        signal: controller.signal,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        ...(options.body === undefined ? {} : { headers: { 'Content-Type': 'application/json' } }),
      };
      const response = await this.fetchImplementation(joinUrl(this.baseUrl, path), requestInit);
      return parseEnvelope((await response.json()) as unknown, parseData);
    } catch (error) {
      if (error instanceof QmsApiError) {
        throw error;
      }
      if (timedOut || isAbortSignalAborted(options.signal) || controller.signal.aborted) {
        throw new QmsApiError('REQUEST_ABORTED', 'Yêu cầu đã được hủy.');
      }
      throw new QmsApiError('NETWORK_ERROR', 'Không kết nối được máy chủ thử nghiệm.');
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}

export function getQmsApiBaseUrl(): string {
  return import.meta.env.VITE_QMS_API_BASE_URL ?? 'http://127.0.0.1:3003';
}

export function createQmsApiClient(baseUrl = getQmsApiBaseUrl()): QmsApiClient {
  return new HttpQmsApiClient({ baseUrl });
}
