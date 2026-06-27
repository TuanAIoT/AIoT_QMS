export interface QmsLocationDto {
  readonly locationId: string;
  readonly locationName: string;
  readonly address: string;
}

export interface QmsAreaDto {
  readonly areaId: string;
  readonly areaName: string;
  readonly locationId: string;
}

export interface QmsServiceDto {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly serviceCode: string;
  readonly areaId: string;
  readonly locationId: string;
  readonly description: string | null;
  readonly bookingEnabled: boolean;
}

export type QmsTicketStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface QmsTicketDto {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly fullName: string;
  readonly bookingDate: string;
  readonly status: QmsTicketStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly checkInExpiresAt: string;
  readonly qrPayload: string;
  readonly canCancel: boolean;
}

export interface QmsCounterDto {
  readonly counterId: string;
  readonly counterName: string;
  readonly status: 'OPEN' | 'CLOSED';
  readonly currentTicketNumber: string | null;
  readonly servingServiceName: string | null;
  readonly updatedAt: string;
}

export interface QmsQueueStatusDto {
  readonly locationId: string;
  readonly locationName: string;
  readonly bookingEnabled: boolean;
  readonly currentDate: string;
  readonly counters: readonly QmsCounterDto[];
  readonly waitingTickets: readonly QmsTicketDto[];
}

export type QmsLocation = QmsLocationDto;
export type QmsArea = QmsAreaDto;
export type QmsService = QmsServiceDto;
export type QmsTicket = QmsTicketDto;
export type QmsCounter = QmsCounterDto;
export type QmsQueueStatus = QmsQueueStatusDto;

export interface QmsBookingHistoryResponseDto {
  readonly currentBooking: QmsTicketDto | null;
  readonly history: readonly QmsTicketDto[];
}

export interface QmsCreateBookingRequest {
  readonly locationId: string;
  readonly areaId: string;
  readonly serviceId: string;
  readonly fullName: string;
  readonly bookingDate: string;
}

export interface QmsBookingApiClient {
  getLocations(signal?: AbortSignal): Promise<readonly QmsLocationDto[]>;
  getAreas(locationId: string, signal?: AbortSignal): Promise<readonly QmsAreaDto[]>;
  getServices(locationId: string, areaIdOrSignal?: string | AbortSignal, signal?: AbortSignal): Promise<readonly QmsServiceDto[]>;
  createBooking(request: QmsCreateBookingRequest, signal?: AbortSignal): Promise<QmsTicketDto>;
  createTicket(
    request: Pick<QmsCreateBookingRequest, 'locationId' | 'serviceId'> &
      Partial<Pick<QmsCreateBookingRequest, 'areaId' | 'fullName' | 'bookingDate'>>,
    signal?: AbortSignal,
  ): Promise<QmsTicketDto>;
  getCurrentBooking(locationId: string, signal?: AbortSignal): Promise<QmsTicketDto | null>;
  listBookingHistory(locationId: string, signal?: AbortSignal): Promise<readonly QmsTicketDto[]>;
  listTickets(request?: { readonly locationId?: string; readonly status?: QmsTicketStatus }, signal?: AbortSignal): Promise<readonly QmsTicketDto[]>;
  getTicket(ticketId: string, signal?: AbortSignal): Promise<QmsTicketDto>;
  cancelTicket(ticketId: string, signal?: AbortSignal): Promise<QmsTicketDto>;
  getQueueStatus(locationId: string, signal?: AbortSignal): Promise<QmsQueueStatusDto>;
  callNext(locationId?: string, signal?: AbortSignal): Promise<{ readonly ticket: QmsTicketDto | null }>;
  resetDevelopmentData(signal?: AbortSignal): Promise<{ readonly reset: true }>;
}

export class QmsApiError extends Error {
  constructor(
    readonly kind:
      | 'CONFIGURATION_ERROR'
      | 'REQUEST_ABORTED'
      | 'NETWORK_ERROR'
      | 'HTTP_ERROR'
      | 'INVALID_RESPONSE',
    message: string,
    readonly status?: number,
    readonly serverCode?: string,
  ) {
    super(message);
    this.name = 'QmsApiError';
  }
}

interface QmsApiOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly signal?: AbortSignal | undefined;
  readonly query?: Readonly<Record<string, string | undefined>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAbortSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isErrorEnvelope(value: unknown): value is { readonly error: { readonly code: string; readonly message: string } } {
  return isRecord(value) && isRecord(value.error) && hasText(value.error.code) && hasText(value.error.message);
}

function isWrappedSuccess(value: unknown): value is { readonly data: unknown } {
  return isRecord(value) && 'data' in value;
}

function unwrapBody<T>(body: unknown, parseData: (value: unknown) => T): T {
  if (isErrorEnvelope(body)) {
    throw new QmsApiError('HTTP_ERROR', body.error.message, undefined, body.error.code);
  }
  if (isWrappedSuccess(body)) {
    return parseData(body.data);
  }
  return parseData(body);
}

function parseLocation(value: unknown): QmsLocationDto {
  if (!isRecord(value) || !hasText(value.locationId) || !hasText(value.locationName) || !hasText(value.address)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu địa điểm không hợp lệ.');
  }
  return { locationId: value.locationId, locationName: value.locationName, address: value.address };
}

function parseArea(value: unknown): QmsAreaDto {
  if (!isRecord(value) || !hasText(value.areaId) || !hasText(value.areaName) || !hasText(value.locationId)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu lĩnh vực không hợp lệ.');
  }
  return { areaId: value.areaId, areaName: value.areaName, locationId: value.locationId };
}

function parseService(value: unknown): QmsServiceDto {
  if (
    !isRecord(value) ||
    !hasText(value.serviceId) ||
    !hasText(value.serviceName) ||
    !hasText(value.serviceCode) ||
    !hasText(value.areaId) ||
    !hasText(value.locationId) ||
    (value.description !== null && !hasText(value.description)) ||
    typeof value.bookingEnabled !== 'boolean'
  ) {
    throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu dịch vụ không hợp lệ.');
  }
  return {
    serviceId: value.serviceId,
    serviceName: value.serviceName,
    serviceCode: value.serviceCode,
    areaId: value.areaId,
    locationId: value.locationId,
    description: value.description ?? null,
    bookingEnabled: value.bookingEnabled,
  };
}

function parseTicketStatus(value: unknown): QmsTicketStatus {
  if (value === 'WAITING' || value === 'CALLED' || value === 'SERVING' || value === 'COMPLETED' || value === 'CANCELLED' || value === 'EXPIRED') {
    return value;
  }
  throw new QmsApiError('INVALID_RESPONSE', 'Trạng thái phiếu không hợp lệ.');
}

function parseTicket(value: unknown): QmsTicketDto {
  if (
    !isRecord(value) ||
    !hasText(value.ticketId) ||
    !hasText(value.ticketNumber) ||
    !hasText(value.locationId) ||
    !hasText(value.locationName) ||
    !hasText(value.areaId) ||
    !hasText(value.areaName) ||
    !hasText(value.serviceId) ||
    !hasText(value.serviceName) ||
    !hasText(value.fullName) ||
    !hasText(value.bookingDate) ||
    !hasText(value.createdAt) ||
    !hasText(value.updatedAt) ||
    !hasText(value.checkInExpiresAt) ||
    !hasText(value.qrPayload) ||
    typeof value.canCancel !== 'boolean'
  ) {
    throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu booking không hợp lệ.');
  }
  return {
    ticketId: value.ticketId,
    ticketNumber: value.ticketNumber,
    locationId: value.locationId,
    locationName: value.locationName,
    areaId: value.areaId,
    areaName: value.areaName,
    serviceId: value.serviceId,
    serviceName: value.serviceName,
    fullName: value.fullName,
    bookingDate: value.bookingDate,
    status: parseTicketStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    checkInExpiresAt: value.checkInExpiresAt,
    qrPayload: value.qrPayload,
    canCancel: value.canCancel,
  };
}

function parseCounter(value: unknown): QmsCounterDto {
  if (
    !isRecord(value) ||
    !hasText(value.counterId) ||
    !hasText(value.counterName) ||
    (value.status !== 'OPEN' && value.status !== 'CLOSED') ||
    (value.currentTicketNumber !== null && !hasText(value.currentTicketNumber)) ||
    (value.servingServiceName !== null && !hasText(value.servingServiceName)) ||
    !hasText(value.updatedAt)
  ) {
    throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu quầy không hợp lệ.');
  }
  return {
    counterId: value.counterId,
    counterName: value.counterName,
    status: value.status,
    currentTicketNumber: value.currentTicketNumber ?? null,
    servingServiceName: value.servingServiceName ?? null,
    updatedAt: value.updatedAt,
  };
}

function parseQueueStatus(value: unknown): QmsQueueStatusDto {
  if (
    !isRecord(value) ||
    !hasText(value.locationId) ||
    !hasText(value.locationName) ||
    typeof value.bookingEnabled !== 'boolean' ||
    !hasText(value.currentDate) ||
    !Array.isArray(value.counters) ||
    !Array.isArray(value.waitingTickets)
  ) {
    throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu tình hình số thứ tự không hợp lệ.');
  }
  return {
    locationId: value.locationId,
    locationName: value.locationName,
    bookingEnabled: value.bookingEnabled,
    currentDate: value.currentDate,
    counters: value.counters.map((counter) => parseCounter(counter)),
    waitingTickets: value.waitingTickets.map((ticket) => parseTicket(ticket)),
  };
}

function parseLocations(value: unknown): readonly QmsLocationDto[] {
  if (!Array.isArray(value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Danh sách địa điểm không hợp lệ.');
  }
  return value.map((item) => parseLocation(item));
}

function parseAreas(value: unknown): readonly QmsAreaDto[] {
  if (!Array.isArray(value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Danh sách lĩnh vực không hợp lệ.');
  }
  return value.map((item) => parseArea(item));
}

function parseServices(value: unknown): readonly QmsServiceDto[] {
  if (!Array.isArray(value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Danh sách dịch vụ không hợp lệ.');
  }
  return value.map((item) => parseService(item));
}

function parseTickets(value: unknown): readonly QmsTicketDto[] {
  if (!Array.isArray(value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Danh sách booking không hợp lệ.');
  }
  return value.map((item) => parseTicket(item));
}

function parseResponseObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new QmsApiError('INVALID_RESPONSE', 'Phản hồi từ máy chủ thử nghiệm không hợp lệ.');
  }
  return value;
}

export class HttpQmsApiClient implements QmsBookingApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: QmsApiOptions) {
    this.baseUrl = options.baseUrl.trim();
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
    if (this.baseUrl.length === 0 || this.timeoutMs <= 0) {
      throw new QmsApiError('CONFIGURATION_ERROR', 'Cấu hình API thử nghiệm không hợp lệ.');
    }
  }

  getLocations(signal?: AbortSignal): Promise<readonly QmsLocationDto[]> {
    return this.request('api/zalo/locations', parseLocations, { signal });
  }

  getAreas(locationId: string, signal?: AbortSignal): Promise<readonly QmsAreaDto[]> {
    return this.request(`api/zalo/locations/${encodeURIComponent(locationId)}/areas`, parseAreas, { signal });
  }

  getServices(
    locationId: string,
    areaIdOrSignal?: string | AbortSignal,
    signal?: AbortSignal,
  ): Promise<readonly QmsServiceDto[]> {
    const areaId = typeof areaIdOrSignal === 'string' ? areaIdOrSignal : undefined;
    const requestSignal = typeof areaIdOrSignal === 'string' ? signal : areaIdOrSignal;
    return this.request(
      `api/zalo/locations/${encodeURIComponent(locationId)}/services`,
      parseServices,
      {
        ...(requestSignal === undefined ? {} : { signal: requestSignal }),
        ...(areaId === undefined ? {} : { query: { areaId } }),
      },
    );
  }

  createTicket(
    request: Pick<QmsCreateBookingRequest, 'locationId' | 'serviceId'> &
      Partial<Pick<QmsCreateBookingRequest, 'areaId' | 'fullName' | 'bookingDate'>>,
    signal?: AbortSignal,
  ): Promise<QmsTicketDto> {
    return this.createBooking(
      {
        locationId: request.locationId,
        areaId: request.areaId ?? '',
        serviceId: request.serviceId,
        fullName: request.fullName ?? '',
        bookingDate: request.bookingDate ?? '',
      },
      signal,
    );
  }

  createBooking(request: QmsCreateBookingRequest, signal?: AbortSignal): Promise<QmsTicketDto> {
    return this.request('api/zalo/bookings', parseTicket, { method: 'POST', body: request, signal });
  }

  getCurrentBooking(locationId: string, signal?: AbortSignal): Promise<QmsTicketDto | null> {
    return this.request(
      `api/zalo/locations/${encodeURIComponent(locationId)}/bookings/current`,
      (value) => {
        if (value === null) {
          return null;
        }
        return parseTicket(value);
      },
      { signal },
    );
  }

  listBookingHistory(locationId: string, signal?: AbortSignal): Promise<readonly QmsTicketDto[]> {
    return this.request(`api/zalo/locations/${encodeURIComponent(locationId)}/bookings/history`, parseTickets, {
      signal,
    });
  }

  listTickets(
    request: { readonly locationId?: string; readonly status?: QmsTicketStatus } = {},
    signal?: AbortSignal,
  ): Promise<readonly QmsTicketDto[]> {
    if (request.locationId === undefined) {
      return this.request('api/zalo/bookings', parseTickets, {
        ...(signal === undefined ? {} : { signal }),
        ...(request.status === undefined ? {} : { query: { status: request.status } }),
      });
    }
    return this.request(
      `api/zalo/locations/${encodeURIComponent(request.locationId)}/bookings/history`,
      parseTickets,
      {
        ...(signal === undefined ? {} : { signal }),
        ...(request.status === undefined ? {} : { query: { status: request.status } }),
      },
    );
  }

  getTicket(ticketId: string, signal?: AbortSignal): Promise<QmsTicketDto> {
    return this.request(`api/zalo/bookings/${encodeURIComponent(ticketId)}`, parseTicket, { signal });
  }

  cancelTicket(ticketId: string, signal?: AbortSignal): Promise<QmsTicketDto> {
    return this.request(`api/zalo/bookings/${encodeURIComponent(ticketId)}/cancel`, parseTicket, {
      method: 'POST',
      signal,
    });
  }

  getQueueStatus(locationId: string, signal?: AbortSignal): Promise<QmsQueueStatusDto> {
    return this.request(`api/zalo/locations/${encodeURIComponent(locationId)}/queue-status`, parseQueueStatus, {
      signal,
    });
  }

  callNext(locationId?: string, signal?: AbortSignal): Promise<{ readonly ticket: QmsTicketDto | null }> {
    return this.request(
      'api/zalo/dev/call-next',
      (value) => {
        const body = parseResponseObject(value);
        if (!('ticket' in body)) {
          throw new QmsApiError('INVALID_RESPONSE', 'Phản hồi gọi số không hợp lệ.');
        }
        return { ticket: body.ticket === null ? null : parseTicket(body.ticket) };
      },
      { method: 'POST', signal, ...(locationId === undefined ? {} : { body: { locationId } }) },
    );
  }

  resetDevelopmentData(signal?: AbortSignal): Promise<{ readonly reset: true }> {
    return this.request(
      'api/zalo/dev/reset',
      (value) => {
        const body = parseResponseObject(value);
        if (body.reset !== true) {
          throw new QmsApiError('INVALID_RESPONSE', 'Phản hồi reset không hợp lệ.');
        }
        return { reset: true as const };
      },
      { method: 'POST', signal },
    );
  }

  private async request<T>(path: string, parseData: (value: unknown) => T, options: RequestOptions = {}): Promise<T> {
    if (isAbortSignalAborted(options.signal)) {
      throw new QmsApiError('REQUEST_ABORTED', 'Yêu cầu đã bị hủy.');
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
      const url = new URL(joinUrl(this.baseUrl, path));
      if (options.query !== undefined) {
        for (const [key, value] of Object.entries(options.query)) {
          if (value !== undefined && value.trim().length > 0) {
            url.searchParams.set(key, value);
          }
        }
      }
      const requestInit: RequestInit = {
        method: options.method ?? 'GET',
        signal: controller.signal,
        ...(options.body === undefined
          ? {}
          : {
              body: JSON.stringify(options.body),
              headers: { 'Content-Type': 'application/json' },
            }),
      };
      const response = await this.fetchImplementation(url.toString(), requestInit);
      const text = await response.text();
      const parsed = text.trim().length === 0 ? null : (JSON.parse(text) as unknown);
      if (!response.ok) {
        if (isErrorEnvelope(parsed)) {
          throw new QmsApiError('HTTP_ERROR', parsed.error.message, response.status, parsed.error.code);
        }
        throw new QmsApiError('HTTP_ERROR', `Máy chủ thử nghiệm trả về lỗi (${String(response.status)}).`, response.status);
      }
      return unwrapBody(parsed, parseData);
    } catch (error) {
      if (error instanceof QmsApiError) {
        throw error;
      }
      if (timedOut || isAbortSignalAborted(options.signal) || controller.signal.aborted) {
        throw new QmsApiError('REQUEST_ABORTED', 'Yêu cầu đã bị hủy.');
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

export function createQmsApiClient(baseUrl = getQmsApiBaseUrl()): QmsBookingApiClient {
  return new HttpQmsApiClient({ baseUrl });
}
