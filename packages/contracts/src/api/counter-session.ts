import type {
  ApiResponse,
  CounterId,
  LocationId,
  SessionId,
  StaffId,
} from '../common.js';
import type { CounterSession } from '../domain.js';

export interface StartCounterSessionRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter selection and authorization are not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Staff identity derivation from authentication is not confirmed. */
  readonly staffId: StaffId;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket-number reset behavior is Server-owned and unconfirmed. */
  readonly resetTicketNumber?: boolean;
}

export interface StartCounterSessionResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Session response payload is not confirmed. */
  readonly session: CounterSession;
}

/** BACKEND_CONFIRMATION_REQUIRED: Start-session response envelope is not confirmed. */
export type StartCounterSessionApiResponse = ApiResponse<StartCounterSessionResponse>;

export interface GetActiveCounterSessionRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location filter requirements are not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Active-session lookup key is not confirmed. */
  readonly counterId: CounterId;
}

export interface GetActiveCounterSessionResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Empty active-session representation is not confirmed. */
  readonly session: CounterSession | null;
}

/** BACKEND_CONFIRMATION_REQUIRED: Active-session response envelope is not confirmed. */
export type GetActiveCounterSessionApiResponse = ApiResponse<GetActiveCounterSessionResponse>;

export interface EndCounterSessionRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session termination key is not confirmed. */
  readonly sessionId: SessionId;
}

export interface EndCounterSessionResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Ended-session response payload is not confirmed. */
  readonly session: CounterSession;
}

/** BACKEND_CONFIRMATION_REQUIRED: End-session response envelope is not confirmed. */
export type EndCounterSessionApiResponse = ApiResponse<EndCounterSessionResponse>;
