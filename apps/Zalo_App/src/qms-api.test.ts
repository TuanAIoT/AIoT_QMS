import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQmsApiClient } from './qms-api';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('qms-api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('parses the wrapped locations response shape', async () => {
    const fetchMock = vi.fn(async () =>
      mockJsonResponse({
        ok: true,
        data: [
          {
            locationId: 'loc-cumta',
            locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA',
            address: '01 Đường Mô Phỏng, Xã Cư Mta, Tỉnh Đắk Lắk',
          },
        ],
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const api = createQmsApiClient('http://127.0.0.1:3003');
    const locations = await api.getLocations();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(locations).toEqual([
      {
        locationId: 'loc-cumta',
        locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA',
        address: '01 Đường Mô Phỏng, Xã Cư Mta, Tỉnh Đắk Lắk',
      },
    ]);
  });

  it('rejects malformed location payloads with schema error', async () => {
    const fetchMock = vi.fn(async () =>
      mockJsonResponse({
        ok: true,
        data: [
          {
            id: 'loc-cumta',
            name: 'Sai field name',
            address: '01 Đường Mô Phỏng',
          },
        ],
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const api = createQmsApiClient('http://127.0.0.1:3003');

    await expect(api.getLocations()).rejects.toMatchObject({
      kind: 'INVALID_RESPONSE',
      message: 'Dữ liệu địa điểm không hợp lệ.',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});