import type {
  ApiResponse,
  CounterId,
  LocationId,
  PaginationRequest,
  PaginationResponse,
  ServiceId,
  SessionId,
  StaffId,
  TicketId,
} from '../common.js';
import type { QueueSummary, Ticket } from '../domain.js';
import type { PriorityLevel } from '../statuses.js';

export interface GetWaitingQueueRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Queue location filter placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter filter support is not confirmed. */
  readonly counterId?: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Service filter support is not confirmed. */
  readonly serviceId?: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Queue pagination support is not confirmed. */
  readonly pagination?: PaginationRequest;
}

export interface GetWaitingQueueResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Waiting queue pagination envelope is not confirmed. */
  readonly queue: PaginationResponse<Ticket>;
  /** BACKEND_CONFIRMATION_REQUIRED: Queue summary inclusion is not confirmed. */
  readonly summary: QueueSummary;
}

/** BACKEND_CONFIRMATION_REQUIRED: Waiting-queue response envelope is not confirmed. */
export type GetWaitingQueueApiResponse = ApiResponse<GetWaitingQueueResponse>;

export interface CallNextRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter command key is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session command key is not confirmed. */
  readonly sessionId: SessionId;
}

export interface CallNextResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: No-ticket behavior and nullability are not confirmed. */
  readonly ticket: Ticket | null;
  /** BACKEND_CONFIRMATION_REQUIRED: Queue summary inclusion is not confirmed. */
  readonly summary: QueueSummary;
}

/** BACKEND_CONFIRMATION_REQUIRED: Call-next response envelope is not confirmed. */
export type CallNextApiResponse = ApiResponse<CallNextResponse>;

export interface RecallRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Recall counter authorization key is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Recall session authorization key is not confirmed. */
  readonly sessionId: SessionId;
  /** BACKEND_CONFIRMATION_REQUIRED: Recall ticket key is not confirmed. */
  readonly ticketId: TicketId;
}

export interface RecallResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Recall result payload is not confirmed. */
  readonly ticket: Ticket;
}

/** BACKEND_CONFIRMATION_REQUIRED: Recall response envelope is not confirmed. */
export type RecallApiResponse = ApiResponse<RecallResponse>;

export interface SkipRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Skip counter authorization key is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Skip session authorization key is not confirmed. */
  readonly sessionId: SessionId;
  /** BACKEND_CONFIRMATION_REQUIRED: Skip ticket key is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Skip reason support and limits are not confirmed. */
  readonly reason?: string;
}

export interface SkipResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Skip result payload is not confirmed. */
  readonly ticket: Ticket;
  /** BACKEND_CONFIRMATION_REQUIRED: Queue summary inclusion is not confirmed. */
  readonly summary: QueueSummary;
}

/** BACKEND_CONFIRMATION_REQUIRED: Skip response envelope is not confirmed. */
export type SkipApiResponse = ApiResponse<SkipResponse>;

export interface TransferRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Transfer ticket key is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Source-counter field requirement is not confirmed. */
  readonly fromCounterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Destination-counter field requirement is not confirmed. */
  readonly toCounterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session ownership during transfer is not confirmed. */
  readonly sessionId: SessionId;
  /** BACKEND_CONFIRMATION_REQUIRED: Multi-service transfer behavior is optional and unconfirmed. */
  readonly nextServiceId?: ServiceId;
}

export interface TransferResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Transfer result payload is not confirmed. */
  readonly ticket: Ticket;
}

/** BACKEND_CONFIRMATION_REQUIRED: Transfer response envelope is not confirmed. */
export type TransferApiResponse = ApiResponse<TransferResponse>;

export interface FinishRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Finish ticket key is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Finish counter authorization key is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Finish session authorization key is not confirmed. */
  readonly sessionId: SessionId;
}

export interface FinishResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Finish result payload is not confirmed. */
  readonly ticket: Ticket;
}

/** BACKEND_CONFIRMATION_REQUIRED: Finish response envelope is not confirmed. */
export type FinishApiResponse = ApiResponse<FinishResponse>;

export interface AssistedTicketRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Location field placement is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Service selection payload is not confirmed. */
  readonly serviceId: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Staff identity derivation from authentication is not confirmed. */
  readonly staffId: StaffId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session requirement for assisted ticketing is not confirmed. */
  readonly sessionId: SessionId;
  /** BACKEND_CONFIRMATION_REQUIRED: Initial counter assignment is Backend-owned and unconfirmed. */
  readonly counterId?: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Priority input versus Server calculation is not confirmed. */
  readonly priorityLevel?: PriorityLevel;
}

export interface AssistedTicketResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Assisted-ticket result payload is not confirmed. */
  readonly ticket: Ticket;
}

/** BACKEND_CONFIRMATION_REQUIRED: Assisted-ticket response envelope is not confirmed. */
export type AssistedTicketApiResponse = ApiResponse<AssistedTicketResponse>;
