// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, APP_NAME } from './App';
import {
  type Booking,
  type BookingApi,
  type CentralLocation,
  type CentralService,
  resolveCentralAppConfig,
} from './central-api';
import {
  initializeZaloRuntime,
  isBrowserDevelopmentEnabled,
  type ZaloRuntimeState,
} from './runtime';

const getSystemInfoMock = vi.hoisted(() => vi.fn());

vi.mock('zmp-sdk/apis', () => ({ getSystemInfo: getSystemInfoMock }));

const BROWSER_READY: ZaloRuntimeState = {
  phase: 'ready',
  runtime: 'browser-development',
};

const LOCATIONS: readonly CentralLocation[] = [
  {
    locationId: 'loc-demo-a',
    code: 'LOC-A',
    displayName: 'Điểm phục vụ Demo A',
    displayAddress: 'Khu vực Demo A',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  {
    locationId: 'loc-demo-b',
    code: 'LOC-B',
    displayName: 'Điểm phục vụ Demo B',
    displayAddress: 'Khu vực Demo B',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
];

const SERVICES_A: readonly CentralService[] = [
  {
    serviceId: 'svc-demo-a',
    locationId: 'loc-demo-a',
    code: 'SVC-A',
    displayName: 'Dịch vụ Demo A',
    bookingEnabled: true,
  },
];

const SERVICES_B: readonly CentralService[] = [
  {
    serviceId: 'svc-demo-b',
    locationId: 'loc-demo-b',
    code: 'SVC-B',
    displayName: 'Dịch vụ Demo B',
    bookingEnabled: true,
  },
];

const BOOKING: Booking = {
  bookingId: 'bkg-demo-a',
  bookingReference: 'BK-7Q4M2K',
  locationId: 'loc-demo-a',
  serviceId: 'svc-demo-a',
  status: 'CONFIRMED',
  requestedStartAt: '2026-06-23T02:00:00.000Z',
  createdAt: '2026-06-22T08:30:00.000Z',
  updatedAt: '2026-06-22T08:30:00.000Z',
  canCancel: true,
};

function initializeBrowser(): Promise<ZaloRuntimeState> {
  return Promise.resolve(BROWSER_READY);
}

function createBookingApi(overrides: Partial<BookingApi> = {}): BookingApi {
  return {
    authenticate: vi.fn(async () => undefined),
    getLocations: vi.fn(async () => LOCATIONS),
    getServices: vi.fn(async (locationId: string) =>
      locationId === LOCATIONS[0]?.locationId ? SERVICES_A : SERVICES_B,
    ),
    createBooking: vi.fn(async () => BOOKING),
    getBookingStatus: vi.fn(async () => ({
      bookingId: BOOKING.bookingId,
      status: BOOKING.status,
      updatedAt: BOOKING.updatedAt,
      stale: false,
    })),
    createCheckInToken: vi.fn<BookingApi['createCheckInToken']>(async () => ({
      bookingId: BOOKING.bookingId,
      tokenType: 'QMS_CHECK_IN',
      checkInToken: 'opaque-qr-token-that-must-not-be-visible',
      issuedAt: '2026-06-22T08:31:00.000Z',
      expiresAt: '2099-06-22T08:51:00.000Z',
    })),
    cancelBooking: vi.fn<BookingApi['cancelBooking']>(async () => ({
      bookingId: BOOKING.bookingId,
      status: 'CANCELLED',
      cancelledAt: '2026-06-22T08:32:00.000Z',
    })),
    ...overrides,
  };
}

async function selectBooking(api: BookingApi): Promise<void> {
  render(
    <App
      initializeRuntime={initializeBrowser}
      bookingApi={api}
      createIdempotencyKey={() => 'test-idempotency-key'}
      now={() => new Date('2026-06-23T02:00:00.000Z')}
      pollIntervalMs={60_000}
    />,
  );
  await waitFor(() => expect(api.getLocations).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText('Điểm phục vụ'), {
    target: { value: LOCATIONS[0]?.locationId },
  });
  await waitFor(() => expect(api.getServices).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText('Dịch vụ'), {
    target: { value: SERVICES_A[0]?.serviceId },
  });
}

describe(APP_NAME, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    getSystemInfoMock.mockReset();
  });

  it('forbids mock auth configuration in production', () => {
    expect(() =>
      resolveCentralAppConfig({
        isDevelopment: false,
        authMode: 'mock',
        baseUrl: 'https://central.invalid/api/v1',
        mockZaloAccessToken: 'must-not-be-used',
      }),
    ).toThrow('Mock Central authentication is disabled in production.');
    expect(isBrowserDevelopmentEnabled(false, 'true')).toBe(false);
  });

  it('bootstraps Mock Central in StrictMode without loading any Zalo SDK API', async () => {
    vi.stubEnv('APP_ID', 'replace-with-zalo-mini-app-id');
    vi.stubEnv('VITE_ZALO_MINI_APP_ID', 'replace-with-zalo-mini-app-id');
    vi.stubEnv('VITE_ZALO_BROWSER_DEVELOPMENT', 'true');
    vi.stubEnv('VITE_CENTRAL_AUTH_MODE', 'mock');
    vi.stubEnv('VITE_CENTRAL_API_BASE_URL', 'http://127.0.0.1:3002/api/v1');
    vi.stubEnv('VITE_MOCK_ZALO_ACCESS_TOKEN', 'mock-zalo-token-user-a');
    const unhandledRejection = vi.fn();
    window.addEventListener('unhandledrejection', unhandledRejection);
    const fetchMock = vi.fn<typeof fetch>(async function (this: unknown, input, init) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (init?.signal?.aborted === true) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const url = String(input);
      if (url.endsWith('/zalo/auth/exchange')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'strict-mode-memory-token',
              expiresAt: '2099-06-22T08:45:00.000Z',
              sessionId: 'strict-mode-session',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/locations')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: LOCATIONS,
              totalItems: LOCATIONS.length,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected development request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(
        <StrictMode>
          <App />
        </StrictMode>,
      );

      await waitFor(() => expect(screen.getByText('Chưa có lượt đang chờ')).toBeTruthy());
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(urls.some((url) => url.endsWith('/zalo/auth/exchange'))).toBe(true);
      expect(urls.some((url) => url.endsWith('/locations'))).toBe(true);
      expect(getSystemInfoMock).not.toHaveBeenCalled();
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(screen.queryByText('CONFIGURATION_ERROR')).toBeNull();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });

  it('authenticates, loads locations, and loads services in browser development', async () => {
    const api = createBookingApi();
    await selectBooking(api);

    expect(api.authenticate).toHaveBeenCalledOnce();
    expect(api.getLocations).toHaveBeenCalledOnce();
    expect(api.getServices).toHaveBeenCalledWith(LOCATIONS[0]?.locationId, expect.any(AbortSignal));
    expect(screen.getByText('Chế độ thử nghiệm')).toBeTruthy();
    expect(screen.getByRole('heading', { name: APP_NAME })).toBeTruthy();
  });

  it('resets the old service when location changes', async () => {
    const api = createBookingApi();
    await selectBooking(api);
    expect(screen.getByLabelText<HTMLSelectElement>('Dịch vụ').value).toBe('svc-demo-a');

    fireEvent.change(screen.getByLabelText('Điểm phục vụ'), {
      target: { value: LOCATIONS[1]?.locationId },
    });

    await waitFor(() => expect(api.getServices).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText<HTMLSelectElement>('Dịch vụ').value).toBe('');
    expect(screen.queryByText('Dịch vụ Demo A')).toBeNull();
    expect(screen.getByText('Dịch vụ Demo B')).toBeTruthy();
  });

  it('creates and displays a booking', async () => {
    const api = createBookingApi();
    await selectBooking(api);

    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));

    await waitFor(() => expect(api.createBooking).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: BOOKING.bookingReference })).toBeTruthy();
    expect(screen.getAllByText('Đã xác nhận').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Điểm phục vụ Demo A').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Dịch vụ Demo A').length).toBeGreaterThan(1);
  });

  it('prevents a double click from creating two bookings', async () => {
    let resolveCreate: ((booking: Booking) => void) | undefined;
    const createPromise = new Promise<Booking>((resolve) => {
      resolveCreate = resolve;
    });
    const api = createBookingApi({ createBooking: vi.fn(() => createPromise) });
    await selectBooking(api);
    const button = screen.getByRole('button', { name: 'Lấy số thứ tự' });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(api.createBooking).toHaveBeenCalledOnce();
    resolveCreate?.(BOOKING);
    await waitFor(() => expect(screen.getByText(BOOKING.bookingReference)).toBeTruthy());
  });

  it('keeps the same idempotency key when retrying the same create action', async () => {
    const create = vi
      .fn<BookingApi['createBooking']>()
      .mockRejectedValueOnce(new Error('Central tạm thời không phản hồi.'))
      .mockResolvedValueOnce(BOOKING);
    const api = createBookingApi({ createBooking: create });
    await selectBooking(api);

    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[0]?.[1]).toBe('test-idempotency-key');
    expect(create.mock.calls[1]?.[1]).toBe('test-idempotency-key');
  });

  it('polls and displays the latest booking status', async () => {
    const api = createBookingApi({
      getBookingStatus: vi.fn<BookingApi['getBookingStatus']>(async () => ({
        bookingId: BOOKING.bookingId,
        status: 'QUEUED',
        updatedAt: '2026-06-22T08:33:00.000Z',
        stale: false,
      })),
    });
    render(
      <App
        initializeRuntime={initializeBrowser}
        bookingApi={api}
        createIdempotencyKey={() => 'poll-key'}
        pollIntervalMs={5}
      />,
    );
    await waitFor(() => expect(api.getLocations).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Điểm phục vụ'), {
      target: { value: LOCATIONS[0]?.locationId },
    });
    await waitFor(() => expect(api.getServices).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Dịch vụ'), {
      target: { value: SERVICES_A[0]?.serviceId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));

    await waitFor(() =>
      expect(screen.getAllByText('Đang trong hàng chờ').length).toBeGreaterThan(0),
    );
  });

  it('renders a QR without exposing its raw token as text', async () => {
    const api = createBookingApi();
    await selectBooking(api);
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));
    await waitFor(() => expect(screen.getByText(BOOKING.bookingReference)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã QR check-in' }));

    await waitFor(() => expect(api.createCheckInToken).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Mã QR check-in').querySelector('svg')).toBeTruthy();
    expect(document.body.textContent).not.toContain('opaque-qr-token-that-must-not-be-visible');
    expect(document.body.innerHTML).not.toContain('opaque-qr-token-that-must-not-be-visible');
  });

  it('removes an expired QR from the UI', async () => {
    const api = createBookingApi({
      createCheckInToken: vi.fn<BookingApi['createCheckInToken']>(async () => ({
        bookingId: BOOKING.bookingId,
        tokenType: 'QMS_CHECK_IN',
        checkInToken: 'short-lived-opaque-token',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 25).toISOString(),
      })),
    });
    await selectBooking(api);
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));
    await waitFor(() => expect(screen.getByText(BOOKING.bookingReference)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã QR check-in' }));

    await waitFor(() => expect(screen.getByLabelText('Mã QR check-in')).toBeTruthy());
    await waitFor(() => expect(screen.queryByLabelText('Mã QR check-in')).toBeNull());
  });

  it('confirms and cancels a booking', async () => {
    const api = createBookingApi();
    const confirmCancel = vi.fn(() => true);
    render(
      <App
        initializeRuntime={initializeBrowser}
        bookingApi={api}
        confirmCancel={confirmCancel}
        createIdempotencyKey={() => 'cancel-key'}
        pollIntervalMs={60_000}
      />,
    );
    await waitFor(() => expect(api.getLocations).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Điểm phục vụ'), {
      target: { value: LOCATIONS[0]?.locationId },
    });
    await waitFor(() => expect(api.getServices).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Dịch vụ'), {
      target: { value: SERVICES_A[0]?.serviceId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));
    await waitFor(() => expect(screen.getByText(BOOKING.bookingReference)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Hủy lượt' }));

    expect(confirmCancel).toHaveBeenCalledOnce();
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledOnce());
    expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
  });

  it('stops polling after a terminal status', async () => {
    const getStatus = vi.fn<BookingApi['getBookingStatus']>(async () => ({
      bookingId: BOOKING.bookingId,
      status: 'CANCELLED',
      updatedAt: '2026-06-22T08:34:00.000Z',
      stale: false,
    }));
    const api = createBookingApi({ getBookingStatus: getStatus });
    render(
      <App
        initializeRuntime={initializeBrowser}
        bookingApi={api}
        createIdempotencyKey={() => 'terminal-key'}
        pollIntervalMs={5}
      />,
    );
    await waitFor(() => expect(api.getLocations).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Điểm phục vụ'), {
      target: { value: LOCATIONS[0]?.locationId },
    });
    await waitFor(() => expect(api.getServices).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Dịch vụ'), {
      target: { value: SERVICES_A[0]?.serviceId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));

    await waitFor(() => expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getStatus).toHaveBeenCalledOnce();
  });

  it('shows initialization errors and retries without crashing', async () => {
    const authenticate = vi
      .fn<BookingApi['authenticate']>()
      .mockRejectedValueOnce(new Error('Mock Central chưa sẵn sàng.'))
      .mockResolvedValueOnce(undefined);
    const api = createBookingApi({ authenticate });
    render(<App initializeRuntime={initializeBrowser} bookingApi={api} />);

    await waitFor(() => expect(screen.getByText('Mock Central chưa sẵn sàng.')).toBeTruthy());
    expect(screen.getByText('NETWORK_ERROR')).toBeTruthy();
    expect(screen.getByText('Lỗi kết nối')).toBeTruthy();
    expect(screen.queryByText('Đang kết nối')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Chưa có lượt đang chờ')).toBeTruthy());
  });

  it('keeps tokens in memory and components do not call fetch directly', () => {
    const apiSource = readFileSync('src/central-api.ts', 'utf8');
    const componentSource = [
      readFileSync('src/App.tsx', 'utf8'),
      readFileSync('src/use-booking-flow.ts', 'utf8'),
    ].join('\n');

    expect(apiSource).not.toMatch(/localStorage|sessionStorage/);
    expect(componentSource).not.toMatch(/\bfetch\s*\(/);
  });

  it('does not call identity, profile, phone, or permission APIs or render PII', async () => {
    const source = [
      readFileSync('src/runtime.ts', 'utf8'),
      readFileSync('src/App.tsx', 'utf8'),
      readFileSync('src/central-api.ts', 'utf8'),
    ].join('\n');
    const api = createBookingApi();
    const { container } = render(<App initializeRuntime={initializeBrowser} bookingApi={api} />);
    await waitFor(() => expect(api.getLocations).toHaveBeenCalledOnce());

    expect(source).not.toMatch(
      /\b(?:getUserInfo|getPhoneNumber|getUserID|authorize|getAuthCode|requestPermission)\s*\(/i,
    );
    expect(container.textContent).not.toMatch(/cccd|căn cước|số điện thoại|email|@/i);
  });

  it('does not crash when the Zalo SDK runtime is unavailable in browser development', async () => {
    const state = await initializeZaloRuntime({ browserDevelopmentEnabled: true }, () => {
      throw new Error('Zalo bridge unavailable');
    });

    expect(state).toEqual(BROWSER_READY);
  });
});
