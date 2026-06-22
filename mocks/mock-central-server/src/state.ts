import { createHash, randomBytes } from 'node:crypto';

import {
  type AuthExchangeResponse,
  type Booking,
  type BookingStatusView,
  type CancellationResponse,
  type CheckInTokenResponse,
  MOCK_LOCATIONS,
  MOCK_SERVICES,
  type MockLocation,
  type MockService,
} from './models.js';

export const DEFAULT_MOCK_ZALO_TOKENS = {
  userA: 'mock-zalo-token-user-a',
  userB: 'mock-zalo-token-user-b',
} as const;

const SESSION_DURATION_MS = 15 * 60 * 1_000;
const CHECK_IN_TOKEN_DURATION_MS = 20 * 60 * 1_000;

interface PrincipalDefinition {
  readonly principalId: string;
  readonly namespace: string;
  readonly zaloToken: string;
  readonly sessionToken: string;
  readonly sessionId: string;
}

interface SessionRecord {
  readonly principalId: string;
  readonly expiresAt: string;
}

interface OwnedBooking {
  readonly ownerPrincipalId: string;
  booking: Booking;
  activeCheckInToken?: string;
}

interface CheckInTokenRecord {
  readonly bookingId: string;
  active: boolean;
}

interface IdempotencyRecord {
  readonly payloadFingerprint: string;
  readonly status: number;
  readonly data: unknown;
}

export interface StateResult<T> {
  readonly status: number;
  readonly data: T;
}

export interface MockPrincipal {
  readonly principalId: string;
  readonly namespace: string;
}

export interface MockCentralStateOptions {
  readonly userAToken?: string;
  readonly userBToken?: string;
  readonly now?: () => Date;
}

export class MockCentralStateError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'MockCentralStateError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  if (!isRecord(value)) {
    throw new TypeError('Only JSON-compatible idempotency payloads are supported.');
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('base64url');
}

function opaqueIdentifier(prefix: string, principalId: string, sequence: number): string {
  const digest = createHash('sha256')
    .update(`${principalId}:${String(sequence)}`)
    .digest('base64url')
    .slice(0, 16);
  return `${prefix}_${digest}`;
}

function createPrincipalDefinitions(
  options: MockCentralStateOptions,
): readonly PrincipalDefinition[] {
  return [
    {
      principalId: 'principal-demo-a',
      namespace: 'namespace-demo-a',
      zaloToken: options.userAToken ?? DEFAULT_MOCK_ZALO_TOKENS.userA,
      sessionToken: 'mock-central-session-a',
      sessionId: 'session-demo-a-6k2p',
    },
    {
      principalId: 'principal-demo-b',
      namespace: 'namespace-demo-b',
      zaloToken: options.userBToken ?? DEFAULT_MOCK_ZALO_TOKENS.userB,
      sessionToken: 'mock-central-session-b',
      sessionId: 'session-demo-b-8r4v',
    },
  ];
}

export class MockCentralState {
  readonly locations: readonly MockLocation[] = MOCK_LOCATIONS;
  readonly services: readonly MockService[] = MOCK_SERVICES;
  private readonly now: () => Date;
  private readonly principals: readonly PrincipalDefinition[];
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly bookings = new Map<string, OwnedBooking>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly checkInTokens = new Map<string, CheckInTokenRecord>();
  private readonly bookingSequences = new Map<string, number>();

  constructor(options: MockCentralStateOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.principals = createPrincipalDefinitions(options);
  }

  exchange(zaloToken: string): AuthExchangeResponse {
    const principal = this.principals.find((candidate) => candidate.zaloToken === zaloToken);
    if (principal === undefined) {
      throw new MockCentralStateError(401, 'UNAUTHORIZED', 'Mock Zalo token is not accepted.');
    }
    const expiresAt = new Date(this.now().getTime() + SESSION_DURATION_MS).toISOString();
    this.sessions.set(principal.sessionToken, { principalId: principal.principalId, expiresAt });
    return {
      accessToken: principal.sessionToken,
      expiresAt,
      sessionId: principal.sessionId,
    };
  }

  authenticate(sessionToken: string | undefined): MockPrincipal {
    if (sessionToken === undefined) {
      throw new MockCentralStateError(401, 'UNAUTHORIZED', 'A mock Central session is required.');
    }
    const session = this.sessions.get(sessionToken);
    const principal = this.principals.find(
      (candidate) => candidate.principalId === session?.principalId,
    );
    if (
      session === undefined ||
      principal === undefined ||
      Date.parse(session.expiresAt) <= this.now().getTime()
    ) {
      throw new MockCentralStateError(401, 'UNAUTHORIZED', 'Mock Central session is invalid.');
    }
    return { principalId: principal.principalId, namespace: principal.namespace };
  }

  listServices(locationId: string): readonly MockService[] {
    if (!this.locations.some((location) => location.locationId === locationId)) {
      throw new MockCentralStateError(404, 'RESOURCE_NOT_FOUND', 'Location was not found.');
    }
    return this.services.filter((service) => service.locationId === locationId);
  }

  createBooking(
    principal: MockPrincipal,
    idempotencyKey: string,
    request: {
      readonly locationId: string;
      readonly serviceId: string;
      readonly requestedStartAt: string;
    },
  ): StateResult<Booking> {
    return this.executeIdempotent(
      principal,
      'POST',
      '/api/v1/bookings',
      idempotencyKey,
      request,
      () => {
        const service = this.services.find(
          (candidate) =>
            candidate.serviceId === request.serviceId &&
            candidate.locationId === request.locationId &&
            candidate.bookingEnabled,
        );
        if (service === undefined) {
          throw new MockCentralStateError(
            422,
            'VALIDATION_FAILED',
            'The selected service is not bookable at this location.',
          );
        }
        const sequence = (this.bookingSequences.get(principal.principalId) ?? 0) + 1;
        this.bookingSequences.set(principal.principalId, sequence);
        const bookingId = opaqueIdentifier('bkg', principal.principalId, sequence);
        const reference = opaqueIdentifier('ref', principal.principalId, sequence)
          .slice(-8)
          .toUpperCase();
        const timestamp = this.now().toISOString();
        const booking: Booking = {
          bookingId,
          bookingReference: `BK-${reference}`,
          locationId: request.locationId,
          serviceId: request.serviceId,
          status: 'CONFIRMED',
          requestedStartAt: request.requestedStartAt,
          createdAt: timestamp,
          updatedAt: timestamp,
          canCancel: true,
        };
        this.bookings.set(bookingId, { ownerPrincipalId: principal.principalId, booking });
        return { status: 201, data: booking };
      },
    );
  }

  getBooking(principal: MockPrincipal, bookingId: string): Booking {
    return this.requireOwnedBooking(principal, bookingId).booking;
  }

  getBookingStatus(principal: MockPrincipal, bookingId: string): BookingStatusView {
    const booking = this.requireOwnedBooking(principal, bookingId).booking;
    return {
      bookingId: booking.bookingId,
      status: booking.status,
      updatedAt: booking.updatedAt,
      stale: false,
    };
  }

  createCheckInToken(
    principal: MockPrincipal,
    bookingId: string,
    idempotencyKey: string,
    request: unknown,
  ): StateResult<CheckInTokenResponse> {
    const path = `/api/v1/bookings/${bookingId}/check-in-token`;
    return this.executeIdempotent(principal, 'POST', path, idempotencyKey, request, () => {
      const owned = this.requireOwnedBooking(principal, bookingId);
      if (owned.booking.status !== 'CONFIRMED' && owned.booking.status !== 'READY_FOR_CHECK_IN') {
        throw new MockCentralStateError(
          409,
          'BOOKING_CONFLICT',
          'Booking state does not allow check-in token issuance.',
        );
      }
      const previousToken = owned.activeCheckInToken;
      const checkInToken = randomBytes(32).toString('base64url');
      const issuedAtDate = this.now();
      const data: CheckInTokenResponse = {
        bookingId,
        tokenType: 'QMS_CHECK_IN',
        checkInToken,
        issuedAt: issuedAtDate.toISOString(),
        expiresAt: new Date(issuedAtDate.getTime() + CHECK_IN_TOKEN_DURATION_MS).toISOString(),
      };
      if (previousToken !== undefined) {
        const previous = this.checkInTokens.get(previousToken);
        if (previous !== undefined) {
          previous.active = false;
        }
      }
      owned.activeCheckInToken = checkInToken;
      this.checkInTokens.set(checkInToken, { bookingId, active: true });
      return { status: 201, data };
    });
  }

  cancelBooking(
    principal: MockPrincipal,
    bookingId: string,
    idempotencyKey: string,
    request: unknown,
  ): StateResult<CancellationResponse> {
    const path = `/api/v1/bookings/${bookingId}/cancel`;
    return this.executeIdempotent(principal, 'POST', path, idempotencyKey, request, () => {
      const owned = this.requireOwnedBooking(principal, bookingId);
      if (!['CREATED', 'CONFIRMED', 'READY_FOR_CHECK_IN'].includes(owned.booking.status)) {
        throw new MockCentralStateError(
          409,
          'BOOKING_CONFLICT',
          'Booking state does not allow cancellation.',
        );
      }
      const cancelledAt = this.now().toISOString();
      owned.booking = {
        ...owned.booking,
        status: 'CANCELLED',
        updatedAt: cancelledAt,
        canCancel: false,
      };
      if (owned.activeCheckInToken !== undefined) {
        const activeToken = this.checkInTokens.get(owned.activeCheckInToken);
        if (activeToken !== undefined) {
          activeToken.active = false;
        }
        delete owned.activeCheckInToken;
      }
      return {
        status: 200,
        data: { bookingId, status: 'CANCELLED', cancelledAt },
      };
    });
  }

  isCheckInTokenActive(token: string): boolean {
    return this.checkInTokens.get(token)?.active === true;
  }

  resetNamespace(principal: MockPrincipal): void {
    const removedBookingIds = new Set<string>();
    for (const [bookingId, owned] of this.bookings) {
      if (owned.ownerPrincipalId === principal.principalId) {
        removedBookingIds.add(bookingId);
        this.bookings.delete(bookingId);
      }
    }
    for (const [token, record] of this.checkInTokens) {
      if (removedBookingIds.has(record.bookingId)) {
        this.checkInTokens.delete(token);
      }
    }
    for (const key of this.idempotency.keys()) {
      if (key.startsWith(`${principal.principalId}|`)) {
        this.idempotency.delete(key);
      }
    }
    this.bookingSequences.delete(principal.principalId);
  }

  private requireOwnedBooking(principal: MockPrincipal, bookingId: string): OwnedBooking {
    const owned = this.bookings.get(bookingId);
    if (owned === undefined || owned.ownerPrincipalId !== principal.principalId) {
      throw new MockCentralStateError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
    }
    return owned;
  }

  private executeIdempotent<T>(
    principal: MockPrincipal,
    method: 'POST',
    canonicalPath: string,
    idempotencyKey: string,
    payload: unknown,
    operation: () => StateResult<T>,
  ): StateResult<T> {
    const scopedKey = `${principal.principalId}|${method}|${canonicalPath}|${idempotencyKey}`;
    const payloadFingerprint = fingerprint(payload);
    const existing = this.idempotency.get(scopedKey);
    if (existing !== undefined) {
      if (existing.payloadFingerprint !== payloadFingerprint) {
        throw new MockCentralStateError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was reused with a different request.',
        );
      }
      return { status: existing.status, data: existing.data as T };
    }
    const result = operation();
    this.idempotency.set(scopedKey, {
      payloadFingerprint,
      status: result.status,
      data: result.data,
    });
    return result;
  }
}
