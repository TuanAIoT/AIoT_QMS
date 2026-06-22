export const BOOKING_STATUSES = [
  'CREATED',
  'CONFIRMED',
  'READY_FOR_CHECK_IN',
  'CHECKED_IN',
  'QUEUED',
  'CALLED',
  'SERVING',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface CentralLocation {
  readonly locationId: string;
  readonly code: string;
  readonly displayName: string;
  readonly displayAddress: string;
  readonly timeZone: string;
}

export interface CentralService {
  readonly serviceId: string;
  readonly locationId: string;
  readonly code: string;
  readonly displayName: string;
  readonly bookingEnabled: boolean;
}

export interface Booking {
  readonly bookingId: string;
  readonly bookingReference: string;
  readonly locationId: string;
  readonly serviceId: string;
  readonly status: BookingStatus;
  readonly requestedStartAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly canCancel: boolean;
}

export interface BookingStatusView {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly updatedAt: string;
  readonly stale: boolean;
}

export interface CheckInToken {
  readonly bookingId: string;
  readonly tokenType: 'QMS_CHECK_IN';
  readonly checkInToken: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface CancellationResult {
  readonly bookingId: string;
  readonly status: 'CANCELLED';
  readonly cancelledAt: string;
}

export interface CreateBookingRequest {
  readonly locationId: string;
  readonly serviceId: string;
  readonly requestedStartAt: string;
}

export interface BookingApi {
  authenticate(signal?: AbortSignal): Promise<void>;
  getLocations(signal?: AbortSignal): Promise<readonly CentralLocation[]>;
  getServices(locationId: string, signal?: AbortSignal): Promise<readonly CentralService[]>;
  createBooking(
    request: CreateBookingRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<Booking>;
  getBookingStatus(bookingId: string, signal?: AbortSignal): Promise<BookingStatusView>;
  createCheckInToken(
    bookingId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CheckInToken>;
  cancelBooking(
    bookingId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CancellationResult>;
}

export interface CentralAppConfig {
  readonly authMode: 'mock';
  readonly baseUrl: string;
  readonly mockZaloAccessToken: string;
  readonly isMockMode: true;
}

export interface CentralEnvironment {
  readonly isDevelopment: boolean;
  readonly baseUrl?: string | undefined;
  readonly authMode?: string | undefined;
  readonly mockZaloAccessToken?: string | undefined;
}

export const CENTRAL_API_ERROR_KINDS = [
  'CONFIGURATION',
  'HTTP',
  'NETWORK',
  'TIMEOUT',
  'ABORTED',
  'INVALID_RESPONSE',
] as const;

export type CentralApiErrorKind = (typeof CENTRAL_API_ERROR_KINDS)[number];

export class CentralApiError extends Error {
  constructor(
    readonly kind: CentralApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CentralApiError';
  }
}

interface CentralApiClientOptions {
  readonly baseUrl: string;
  readonly mockZaloAccessToken: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal | undefined;
  readonly authenticated?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && BOOKING_STATUSES.some((status) => status === value);
}

function invalidResponse(): never {
  throw new CentralApiError('INVALID_RESPONSE', 'Phản hồi từ Central không hợp lệ.');
}

function parseLocation(value: unknown): CentralLocation {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['locationId', 'code', 'displayName', 'displayAddress', 'timeZone']) ||
    !nonEmptyString(value.locationId) ||
    !nonEmptyString(value.code) ||
    !nonEmptyString(value.displayName) ||
    !nonEmptyString(value.displayAddress) ||
    !nonEmptyString(value.timeZone)
  ) {
    return invalidResponse();
  }
  return {
    locationId: value.locationId,
    code: value.code,
    displayName: value.displayName,
    displayAddress: value.displayAddress,
    timeZone: value.timeZone,
  };
}

function parseService(value: unknown): CentralService {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['serviceId', 'locationId', 'code', 'displayName', 'bookingEnabled']) ||
    !nonEmptyString(value.serviceId) ||
    !nonEmptyString(value.locationId) ||
    !nonEmptyString(value.code) ||
    !nonEmptyString(value.displayName) ||
    typeof value.bookingEnabled !== 'boolean'
  ) {
    return invalidResponse();
  }
  return {
    serviceId: value.serviceId,
    locationId: value.locationId,
    code: value.code,
    displayName: value.displayName,
    bookingEnabled: value.bookingEnabled,
  };
}

function parseBooking(value: unknown): Booking {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'bookingId',
      'bookingReference',
      'locationId',
      'serviceId',
      'status',
      'requestedStartAt',
      'createdAt',
      'updatedAt',
      'canCancel',
    ]) ||
    !nonEmptyString(value.bookingId) ||
    !nonEmptyString(value.bookingReference) ||
    !nonEmptyString(value.locationId) ||
    !nonEmptyString(value.serviceId) ||
    !isBookingStatus(value.status) ||
    !nonEmptyString(value.requestedStartAt) ||
    !nonEmptyString(value.createdAt) ||
    !nonEmptyString(value.updatedAt) ||
    typeof value.canCancel !== 'boolean'
  ) {
    return invalidResponse();
  }
  return {
    bookingId: value.bookingId,
    bookingReference: value.bookingReference,
    locationId: value.locationId,
    serviceId: value.serviceId,
    status: value.status,
    requestedStartAt: value.requestedStartAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    canCancel: value.canCancel,
  };
}

function parseStatus(value: unknown): BookingStatusView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['bookingId', 'status', 'updatedAt', 'stale']) ||
    !nonEmptyString(value.bookingId) ||
    !isBookingStatus(value.status) ||
    !nonEmptyString(value.updatedAt) ||
    typeof value.stale !== 'boolean'
  ) {
    return invalidResponse();
  }
  return {
    bookingId: value.bookingId,
    status: value.status,
    updatedAt: value.updatedAt,
    stale: value.stale,
  };
}

function parseCheckInToken(value: unknown): CheckInToken {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['bookingId', 'tokenType', 'checkInToken', 'issuedAt', 'expiresAt']) ||
    !nonEmptyString(value.bookingId) ||
    value.tokenType !== 'QMS_CHECK_IN' ||
    !nonEmptyString(value.checkInToken) ||
    !nonEmptyString(value.issuedAt) ||
    !nonEmptyString(value.expiresAt)
  ) {
    return invalidResponse();
  }
  return {
    bookingId: value.bookingId,
    tokenType: value.tokenType,
    checkInToken: value.checkInToken,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  };
}

function parseCancellation(value: unknown): CancellationResult {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['bookingId', 'status', 'cancelledAt']) ||
    !nonEmptyString(value.bookingId) ||
    value.status !== 'CANCELLED' ||
    !nonEmptyString(value.cancelledAt)
  ) {
    return invalidResponse();
  }
  return {
    bookingId: value.bookingId,
    status: value.status,
    cancelledAt: value.cancelledAt,
  };
}

function parseAuth(value: unknown): { readonly accessToken: string } {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['accessToken', 'expiresAt', 'sessionId']) ||
    !nonEmptyString(value.accessToken) ||
    !nonEmptyString(value.expiresAt) ||
    !nonEmptyString(value.sessionId)
  ) {
    return invalidResponse();
  }
  return { accessToken: value.accessToken };
}

function parsePagination<T>(value: unknown, parseItem: (item: unknown) => T): readonly T[] {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['items', 'totalItems', 'page', 'pageSize', 'totalPages']) ||
    !Array.isArray(value.items) ||
    typeof value.totalItems !== 'number' ||
    !Number.isInteger(value.totalItems) ||
    value.totalItems < 0 ||
    typeof value.page !== 'number' ||
    !Number.isInteger(value.page) ||
    value.page < 1 ||
    typeof value.pageSize !== 'number' ||
    !Number.isInteger(value.pageSize) ||
    value.pageSize < 1 ||
    typeof value.totalPages !== 'number' ||
    !Number.isInteger(value.totalPages) ||
    value.totalPages < 0
  ) {
    return invalidResponse();
  }
  return value.items.map(parseItem);
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function safeErrorMessage(value: unknown): string {
  const code = safeErrorCode(value);
  if (code === 'UNAUTHORIZED') {
    return 'Phiên Central không hợp lệ hoặc đã hết hạn.';
  }
  if (code === 'BOOKING_CONFLICT' || code === 'IDEMPOTENCY_CONFLICT') {
    return 'Trạng thái lượt đã thay đổi. Vui lòng tải lại và thử lại.';
  }
  if (code === 'RATE_LIMITED') {
    return 'Có quá nhiều yêu cầu. Vui lòng thử lại sau.';
  }
  return 'Central từ chối yêu cầu.';
}

function safeErrorCode(value: unknown): string | undefined {
  return isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    nonEmptyString(value.error.code)
    ? value.error.code
    : undefined;
}

export function resolveCentralAppConfig(environment: CentralEnvironment): CentralAppConfig {
  if (environment.authMode === 'mock' && !environment.isDevelopment) {
    throw new CentralApiError(
      'CONFIGURATION',
      'Mock Central authentication is disabled in production.',
    );
  }
  if (
    !environment.isDevelopment ||
    environment.authMode !== 'mock' ||
    !nonEmptyString(environment.baseUrl) ||
    !nonEmptyString(environment.mockZaloAccessToken)
  ) {
    throw new CentralApiError('CONFIGURATION', 'Cấu hình Mock Central chưa đầy đủ.');
  }
  return {
    authMode: 'mock',
    baseUrl: environment.baseUrl,
    mockZaloAccessToken: environment.mockZaloAccessToken,
    isMockMode: true,
  };
}

export function getCentralAppConfig(): CentralAppConfig {
  return resolveCentralAppConfig({
    isDevelopment: import.meta.env.DEV,
    baseUrl: import.meta.env.VITE_CENTRAL_API_BASE_URL,
    authMode: import.meta.env.VITE_CENTRAL_AUTH_MODE,
    mockZaloAccessToken: import.meta.env.DEV
      ? import.meta.env.VITE_MOCK_ZALO_ACCESS_TOKEN
      : undefined,
  });
}

export function createIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `zalo-${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export class CentralApiClient implements BookingApi {
  private readonly baseUrl: string;
  private readonly mockZaloAccessToken: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;
  private accessToken: string | undefined;

  constructor(options: CentralApiClientOptions) {
    if (!nonEmptyString(options.baseUrl) || !nonEmptyString(options.mockZaloAccessToken)) {
      throw new CentralApiError('CONFIGURATION', 'Cấu hình Central API không hợp lệ.');
    }
    this.baseUrl = options.baseUrl;
    this.mockZaloAccessToken = options.mockZaloAccessToken;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new CentralApiError('CONFIGURATION', 'Central timeout phải là số dương.');
    }
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
  }

  async authenticate(signal?: AbortSignal): Promise<void> {
    this.accessToken = undefined;
    const result = await this.request('zalo/auth/exchange', parseAuth, {
      method: 'POST',
      body: { zaloAccessToken: this.mockZaloAccessToken },
      signal,
      authenticated: false,
    });
    this.accessToken = result.accessToken;
  }

  getLocations(signal?: AbortSignal): Promise<readonly CentralLocation[]> {
    return this.request('locations', (value) => parsePagination(value, parseLocation), { signal });
  }

  getServices(locationId: string, signal?: AbortSignal): Promise<readonly CentralService[]> {
    return this.request(
      `locations/${encodeURIComponent(locationId)}/services`,
      (value) => parsePagination(value, parseService),
      { signal },
    );
  }

  createBooking(
    request: CreateBookingRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<Booking> {
    return this.request('bookings', parseBooking, {
      method: 'POST',
      body: request,
      idempotencyKey,
      signal,
    });
  }

  getBookingStatus(bookingId: string, signal?: AbortSignal): Promise<BookingStatusView> {
    return this.request(`bookings/${encodeURIComponent(bookingId)}/status`, parseStatus, {
      signal,
    });
  }

  createCheckInToken(
    bookingId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CheckInToken> {
    return this.request(
      `bookings/${encodeURIComponent(bookingId)}/check-in-token`,
      parseCheckInToken,
      {
        method: 'POST',
        body: {},
        idempotencyKey,
        signal,
      },
    );
  }

  cancelBooking(
    bookingId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CancellationResult> {
    return this.request(`bookings/${encodeURIComponent(bookingId)}/cancel`, parseCancellation, {
      method: 'POST',
      body: {},
      idempotencyKey,
      signal,
    });
  }

  private async request<T>(
    path: string,
    parseData: (value: unknown) => T,
    options: RequestOptions = {},
  ): Promise<T> {
    if (isSignalAborted(options.signal)) {
      throw new CentralApiError('ABORTED', 'Yêu cầu đã được hủy.');
    }
    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const headers = new Headers({ Accept: 'application/json' });
      if (options.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }
      if (options.idempotencyKey !== undefined) {
        headers.set('Idempotency-Key', options.idempotencyKey);
      }
      if (options.authenticated !== false) {
        if (this.accessToken === undefined) {
          throw new CentralApiError('CONFIGURATION', 'Central session is not initialized.');
        }
        headers.set('Authorization', `Bearer ${this.accessToken}`);
      }
      const response = await this.fetchImplementation(joinUrl(this.baseUrl, path), {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      const responseText = await response.text();
      if (response.status === 401) {
        this.accessToken = undefined;
      }
      let envelope: unknown;
      try {
        envelope = JSON.parse(responseText) as unknown;
      } catch {
        return invalidResponse();
      }
      if (!response.ok) {
        throw new CentralApiError(
          'HTTP',
          safeErrorMessage(envelope),
          response.status,
          safeErrorCode(envelope),
        );
      }
      if (!isRecord(envelope) || envelope.success !== true || !('data' in envelope)) {
        return invalidResponse();
      }
      return parseData(envelope.data);
    } catch (error) {
      if (error instanceof CentralApiError) {
        throw error;
      }
      if (timedOut) {
        throw new CentralApiError('TIMEOUT', 'Kết nối Central đã hết thời gian chờ.');
      }
      if (isSignalAborted(options.signal)) {
        throw new CentralApiError('ABORTED', 'Yêu cầu đã được hủy.');
      }
      throw new CentralApiError('NETWORK', 'Không thể kết nối Mock Central.');
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }
}

export function createCentralApiClient(config: CentralAppConfig): BookingApi {
  return new CentralApiClient({
    baseUrl: config.baseUrl,
    mockZaloAccessToken: config.mockZaloAccessToken,
  });
}
