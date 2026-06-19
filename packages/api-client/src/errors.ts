import type { ApiError } from '@qms/contracts';

export const API_CLIENT_ERROR_KINDS = [
  'HTTP_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'EMPTY_RESPONSE',
  'INVALID_JSON',
] as const;

export type ApiClientErrorKind = (typeof API_CLIENT_ERROR_KINDS)[number];

export interface ApiClientErrorOptions {
  readonly kind: ApiClientErrorKind;
  readonly message: string;
  readonly status?: number;
  readonly apiError?: ApiError;
  readonly cause?: unknown;
}

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind;
  readonly status?: number;
  readonly apiError?: ApiError;

  constructor(options: ApiClientErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiClientError';
    this.kind = options.kind;

    if (options.status !== undefined) {
      this.status = options.status;
    }

    if (options.apiError !== undefined) {
      this.apiError = options.apiError;
    }
  }
}
