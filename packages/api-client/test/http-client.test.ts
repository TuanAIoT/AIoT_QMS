import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, HttpClient, createApiClient } from '../src/index.js';

const successBody = { success: true, data: { loggedOut: true } };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns a successful JSON response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(successBody));
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1' });

    await expect(client.request('auth/logout', { method: 'POST', body: {} })).resolves.toEqual(
      successBody,
    );
  });

  it.each([400, 401, 500])('throws an HTTP error for status %s', async (status) => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: `HTTP_${String(status)}`, message: 'Request rejected' }, status),
    );
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1' });

    const request = client.request('auth/login');
    await expect(request).rejects.toMatchObject({
      kind: 'HTTP_ERROR',
      status,
      apiError: { code: `HTTP_${String(status)}`, message: 'Request rejected' },
    });
  });

  it('wraps a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('connection failed'));
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1' });

    await expect(client.request('dashboard/summary')).rejects.toMatchObject({
      kind: 'NETWORK_ERROR',
    });
  });

  it('aborts and reports a timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1', timeoutMs: 25 });

    const request = client.request('queue/waiting');
    const timeoutExpectation = expect(request).rejects.toMatchObject({ kind: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(25);

    await timeoutExpectation;
  });

  it('rejects an empty response', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1' });

    await expect(client.request('queue/waiting')).rejects.toMatchObject({
      kind: 'EMPTY_RESPONSE',
    });
  });

  it('adds an Authorization header when an access token is available', async () => {
    fetchMock.mockResolvedValue(jsonResponse(successBody));
    const client = new HttpClient({
      baseUrl: 'https://example.test/api/v1',
      getAccessToken: () => 'test-token',
    });

    await client.request('auth/logout');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('does not add an Authorization header when no token provider exists', async () => {
    fetchMock.mockResolvedValue(jsonResponse(successBody));
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1' });

    await client.request('auth/logout');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });

  it.each([
    ['https://example.test/api/v1', 'https://example.test/api/v1/auth/login'],
    ['https://example.test/api/v1/', 'https://example.test/api/v1/auth/login'],
  ])('normalizes baseUrl %s', async (baseUrl, expectedUrl) => {
    fetchMock.mockResolvedValue(jsonResponse(successBody));
    const client = new HttpClient({ baseUrl });

    await client.request('/auth/login');

    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
  });

  it('exposes domain clients with documented endpoint paths', async () => {
    fetchMock.mockResolvedValue(jsonResponse(successBody));
    const client = createApiClient({ baseUrl: 'https://example.test/api/v1' });

    await client.authClient.logout({});

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses the custom ApiClientError class', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const client = new HttpClient({ baseUrl: 'https://example.test/api/v1' });

    await expect(client.request('queue/waiting')).rejects.toBeInstanceOf(ApiClientError);
  });
});
