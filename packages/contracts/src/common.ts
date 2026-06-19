/** BACKEND_CONFIRMATION_REQUIRED: Entity identifier format is not confirmed. */
export type EntityId = string;

/** BACKEND_CONFIRMATION_REQUIRED: Date-time format and clock rules are not confirmed. */
export type ISODateTimeString = string;

/** BACKEND_CONFIRMATION_REQUIRED: Location identifier format is not confirmed. */
export type LocationId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Device identifier format is not confirmed. */
export type DeviceId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Counter identifier format is not confirmed. */
export type CounterId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Staff identifier format is not confirmed. */
export type StaffId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Service identifier format is not confirmed. */
export type ServiceId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Session identifier format is not confirmed. */
export type SessionId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Ticket identifier format is not confirmed. */
export type TicketId = EntityId;

/** BACKEND_CONFIRMATION_REQUIRED: Event identifier format and generation rules are not confirmed. */
export type EventId = EntityId;

export interface ApiError {
  /** BACKEND_CONFIRMATION_REQUIRED: Error code catalogue is not confirmed. */
  readonly code: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Error message localization rules are not confirmed. */
  readonly message: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Error detail shape is not confirmed. */
  readonly details?: Readonly<Record<string, unknown>>;
}

/** BACKEND_CONFIRMATION_REQUIRED: The success/error response envelope is not confirmed. */
export type ApiResponse<T> =
  | {
      /** BACKEND_CONFIRMATION_REQUIRED: Success discriminator is not confirmed. */
      readonly success: true;
      /** BACKEND_CONFIRMATION_REQUIRED: Success data field is not confirmed. */
      readonly data: T;
      /** BACKEND_CONFIRMATION_REQUIRED: Error omission on success is not confirmed. */
      readonly error?: never;
    }
  | {
      /** BACKEND_CONFIRMATION_REQUIRED: Failure discriminator is not confirmed. */
      readonly success: false;
      /** BACKEND_CONFIRMATION_REQUIRED: Data omission on failure is not confirmed. */
      readonly data?: never;
      /** BACKEND_CONFIRMATION_REQUIRED: Failure error field is not confirmed. */
      readonly error: ApiError;
    };

export interface PaginationRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Page numbering origin and limits are not confirmed. */
  readonly page: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Allowed page sizes are not confirmed. */
  readonly pageSize: number;
}

export interface PaginationResponse<T> {
  /** BACKEND_CONFIRMATION_REQUIRED: Pagination item envelope is not confirmed. */
  readonly items: readonly T[];
  /** BACKEND_CONFIRMATION_REQUIRED: Total-count semantics are not confirmed. */
  readonly totalItems: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Page numbering origin is not confirmed. */
  readonly page: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Returned page-size semantics are not confirmed. */
  readonly pageSize: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Total-page calculation semantics are not confirmed. */
  readonly totalPages: number;
}
