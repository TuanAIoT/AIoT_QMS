// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { CentralApiClient, CentralApiError } from './central-api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CentralApiClient', () => {
  it('parses the nested error envelope without exposing credentials', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Phiên thử nghiệm không hợp lệ.' },
        },
        401,
      ),
    );
    const client = new CentralApiClient({
      baseUrl: 'http://central.test/api/v1',
      mockZaloAccessToken: 'private-mock-token',
      fetchImplementation,
    });

    await expect(client.authenticate()).rejects.toMatchObject({
      kind: 'HTTP',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Phiên Central không hợp lệ hoặc đã hết hạn.',
    });
    await expect(client.authenticate()).rejects.not.toThrow('private-mock-token');
  });

  it('times out safely and aborts the request', async () => {
    const fetchImplementation: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    const client = new CentralApiClient({
      baseUrl: 'http://central.test/api/v1',
      mockZaloAccessToken: 'private-mock-token',
      timeoutMs: 1,
      fetchImplementation,
    });

    await expect(client.authenticate()).rejects.toBeInstanceOf(CentralApiError);
    await expect(client.authenticate()).rejects.toMatchObject({ kind: 'TIMEOUT' });
  });

  it('keeps the Central session in memory and sends it only as a Bearer header', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            accessToken: 'central-memory-token',
            expiresAt: '2026-06-22T08:45:00.000Z',
            sessionId: 'session-demo',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { items: [], totalItems: 0, page: 1, pageSize: 20, totalPages: 0 },
        }),
      );
    const client = new CentralApiClient({
      baseUrl: 'http://central.test/api/v1',
      mockZaloAccessToken: 'mock-zalo-token',
      fetchImplementation,
    });

    await client.authenticate();
    await client.getLocations();

    const secondRequest = fetchImplementation.mock.calls[1];
    const headers = new Headers(secondRequest?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer central-memory-token');
    expect(String(secondRequest?.[0])).not.toContain('central-memory-token');
  });

  it('clears the in-memory session after an unauthorized API response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            accessToken: 'central-memory-token',
            expiresAt: '2026-06-22T08:45:00.000Z',
            sessionId: 'session-demo',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired.' } },
          401,
        ),
      );
    const client = new CentralApiClient({
      baseUrl: 'http://central.test/api/v1',
      mockZaloAccessToken: 'mock-zalo-token',
      fetchImplementation,
    });

    await client.authenticate();
    await expect(client.getLocations()).rejects.toMatchObject({ status: 401 });
    await expect(client.getLocations()).rejects.toMatchObject({ kind: 'CONFIGURATION' });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('clears the previous session before attempting authentication again', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            accessToken: 'central-memory-token',
            expiresAt: '2026-06-22T08:45:00.000Z',
            sessionId: 'session-demo',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Mock token rejected.' } },
          401,
        ),
      );
    const client = new CentralApiClient({
      baseUrl: 'http://central.test/api/v1',
      mockZaloAccessToken: 'mock-zalo-token',
      fetchImplementation,
    });

    await client.authenticate();
    await expect(client.authenticate()).rejects.toMatchObject({ status: 401 });
    await expect(client.getLocations()).rejects.toMatchObject({ kind: 'CONFIGURATION' });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('rejects extra response fields instead of accepting possible PII', async () => {
    const client = new CentralApiClient({
      baseUrl: 'http://central.test/api/v1',
      mockZaloAccessToken: 'mock-zalo-token',
      fetchImplementation: vi.fn<typeof fetch>(async () =>
        jsonResponse({
          success: true,
          data: {
            accessToken: 'central-memory-token',
            expiresAt: '2026-06-22T08:45:00.000Z',
            sessionId: 'session-demo',
            unexpectedIdentity: 'must-be-rejected',
          },
        }),
      ),
    });

    await expect(client.authenticate()).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });
});
