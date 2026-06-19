import type { ApiResponse, ISODateTimeString, LocationId } from '../common.js';
import type { Counter, Device, QueueSummary } from '../domain.js';

export interface DashboardSummaryRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Dashboard location filter placement is not confirmed. */
  readonly locationId: LocationId;
}

export interface DashboardSummaryResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Dashboard queue-summary projection is not confirmed. */
  readonly queue: QueueSummary;
  /** BACKEND_CONFIRMATION_REQUIRED: Dashboard counter projection is not confirmed. */
  readonly counters: readonly Counter[];
  /** BACKEND_CONFIRMATION_REQUIRED: Dashboard device projection is not confirmed. */
  readonly devices: readonly Device[];
  /** BACKEND_CONFIRMATION_REQUIRED: Dashboard snapshot timestamp rules are not confirmed. */
  readonly updatedAt: ISODateTimeString;
}

/** BACKEND_CONFIRMATION_REQUIRED: Dashboard response envelope is not confirmed. */
export type DashboardSummaryApiResponse = ApiResponse<DashboardSummaryResponse>;
