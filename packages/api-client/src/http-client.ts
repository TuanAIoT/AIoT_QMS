import type { ApiError } from '@qms/contracts';

import type { ApiClientConfig } from './config.js';
import { ApiClientError } from './errors.js';

export interface HttpRequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseApiError(value: unknown): ApiError | undefined {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
    return undefined;
  }

  return !isRecord(value.details)
    ? { code: value.code, message: value.message }
    : { code: value.code, message: value.message, details: value.details };
}

function appendQuery(
  url: string,
  query: Readonly<Record<string, string | number | boolean | undefined>> | undefined,
): string {
  if (query === undefined) {
    return url;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString.length === 0 ? url : `${url}?${queryString}`;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function readJson(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (responseText.trim().length === 0) {
    throw new ApiClientError({
      kind: 'EMPTY_RESPONSE',
      message: 'The API returned an empty response body.',
      status: response.status,
    });
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (cause) {
    throw new ApiClientError({
      kind: 'INVALID_JSON',
      message: 'The API returned invalid JSON.',
      status: response.status,
      cause,
    });
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: ApiClientConfig['getAccessToken'];
  private readonly timeoutMs: number | undefined;

  constructor(config: ApiClientConfig) {
    if (config.baseUrl.trim().length === 0) {
      throw new TypeError('ApiClientConfig.baseUrl must not be empty.');
    }

    if (
      config.timeoutMs !== undefined &&
      (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0)
    ) {
      throw new TypeError('ApiClientConfig.timeoutMs must be a positive number.');
    }

    this.baseUrl = config.baseUrl;
    this.getAccessToken = config.getAccessToken;
    this.timeoutMs = config.timeoutMs;
  }

  async request<TResponse>(path: string, options: HttpRequestOptions = {}): Promise<TResponse> {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId =
      this.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            didTimeout = true;
            controller.abort();
          }, this.timeoutMs);

    try {
      const token = await this.getAccessToken?.();
      const headers = new Headers({ Accept: 'application/json' });
      if (options.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }
      if (token !== undefined && token !== null && token.trim().length > 0) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(appendQuery(joinUrl(this.baseUrl, path), options.query), {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });

      const parsedBody = await readJson(response);
      if (!response.ok) {
        const apiError = parseApiError(parsedBody);
        throw new ApiClientError({
          kind: 'HTTP_ERROR',
          message: apiError?.message ?? `The API returned HTTP ${response.status}.`,
          status: response.status,
          ...(apiError === undefined ? {} : { apiError }),
        });
      }

      // Runtime response schemas remain BACKEND_CONFIRMATION_REQUIRED; callers receive the
      // public contract type while this transport only guarantees valid, non-empty JSON.
      return parsedBody as TResponse;
    } catch (cause) {
      if (cause instanceof ApiClientError) {
        throw cause;
      }

      if (didTimeout) {
        throw new ApiClientError({
          kind: 'TIMEOUT',
          message: `The API request timed out after ${String(this.timeoutMs)} ms.`,
          cause,
        });
      }

      throw new ApiClientError({
        kind: 'NETWORK_ERROR',
        message: 'The API request failed before a response was received.',
        cause,
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
