// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_NAME, App } from './App';
import { createQmsApiClient, QmsApiError } from './qms-api';
import type { QmsBookingApiClient, QmsLocationDto, QmsQueueStatusDto, QmsServiceDto, QmsTicketDto } from './qms-api';

const LOCATIONS: readonly QmsLocationDto[] = [
  { locationId: 'loc-001', locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA', address: '01 Đường Mô Phỏng, Xã Cư Mta' },
  { locationId: 'loc-002', locationName: 'ĐƠN VỊ THỬ NGHIỆM 02', address: '02 Đường Mô Phỏng' },
];

const AREAS = [
  { areaId: 'area-justice', areaName: 'Tư pháp, hộ tịch', locationId: 'loc-001' },
];

const SERVICES: readonly QmsServiceDto[] = [
  {
    serviceId: 'svc-justice-1',
    serviceCode: 'A01',
    serviceName: 'Khai sinh, khai tử',
    areaId: 'area-justice',
    locationId: 'loc-001',
    description: 'Tiếp nhận hộ tịch',
    bookingEnabled: true,
  },
];

function createTicket(overrides: Partial<QmsTicketDto> = {}): QmsTicketDto {
  return {
    ticketId: 'ticket-demo-001',
    ticketNumber: '0001',
    locationId: 'loc-001',
    locationName: LOCATIONS[0]!.locationName,
    areaId: 'area-justice',
    areaName: 'Tư pháp, hộ tịch',
    serviceId: 'svc-justice-1',
    serviceName: 'Khai sinh, khai tử',
    fullName: 'Nguyễn Văn A',
    bookingDate: '2026-06-27',
    status: 'WAITING',
    createdAt: '2026-06-26T00:00:00.000Z',
    updatedAt: '2026-06-26T00:05:00.000Z',
    checkInExpiresAt: '2026-06-26T01:00:00.000Z',
    qrPayload: JSON.stringify({ ticketId: 'ticket-demo-001' }),
    canCancel: true,
    ...overrides,
  };
}

function createQueueStatus(): QmsQueueStatusDto {
  return {
    locationId: 'loc-001',
    locationName: LOCATIONS[0]!.locationName,
    bookingEnabled: true,
    currentDate: '2026-06-26T00:10:00.000Z',
    counters: [
      {
        counterId: 'counter-01',
        counterName: 'Quầy 01',
        status: 'OPEN',
        currentTicketNumber: '0001',
        servingServiceName: 'Khai sinh, khai tử',
        updatedAt: '2026-06-26T00:10:00.000Z',
      },
    ],
    waitingTickets: [createTicket()],
  };
}

function createApi(overrides: Partial<QmsBookingApiClient> = {}): QmsBookingApiClient {
  return {
    getLocations: vi.fn(async () => LOCATIONS),
    getAreas: vi.fn(async () => AREAS),
    getServices: vi.fn(async () => SERVICES),
    createBooking: vi.fn(async () => createTicket({ ticketId: 'ticket-demo-002', ticketNumber: '0002' })),
    createTicket: vi.fn(async () => createTicket({ ticketId: 'ticket-demo-002', ticketNumber: '0002' })),
    getCurrentBooking: vi.fn(async () => createTicket()),
    listBookingHistory: vi.fn(async () => [createTicket({ status: 'COMPLETED' })]),
    listTickets: vi.fn(async () => [createTicket(), createTicket({ status: 'COMPLETED' })]),
    getTicket: vi.fn(async () => createTicket()),
    cancelTicket: vi.fn(async () => createTicket({ status: 'CANCELLED', canCancel: false })),
    getQueueStatus: vi.fn(async () => createQueueStatus()),
    callNext: vi.fn(async () => ({ ticket: createTicket({ status: 'CALLED' }) })),
    resetDevelopmentData: vi.fn(async () => ({ reset: true as const })),
    ...overrides,
  };
}

function renderApp(api = createApi()) {
  return render(
    <StrictMode>
      <App apiClient={api} initializeRuntime={async () => ({ phase: 'ready', runtime: 'browser-development' })} />
    </StrictMode>,
  );
}

async function openBookingForm(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Đặt số trực tuyến/ }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(LOCATIONS[0]!.locationName) }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(AREAS[0]!.areaName) }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(SERVICES[0]!.serviceName) }));
}

describe('Zalo App booking flow', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the home screen and contact links', async () => {
    const api = createApi();
    renderApp(api);

    expect(await screen.findByRole('heading', { name: 'AIoT JSC QMS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Đặt số trực tuyến/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Số đã đặt/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tình hình số thứ tự/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Website:/ }).getAttribute('href')).toBe('https://aiots.vn');
    await waitFor(() => expect(api.getLocations).toHaveBeenCalledTimes(1));
  });

  it('parses wrapped location responses from the mock server', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, data: LOCATIONS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createQmsApiClient('http://127.0.0.1:3003');

    await expect(api.getLocations()).resolves.toEqual(LOCATIONS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows schema errors distinctly from connection errors', async () => {
    const api = createApi({
      getLocations: vi.fn(async () => {
        throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu địa điểm không hợp lệ.');
      }),
    });
    renderApp(api);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Dữ liệu từ máy chủ thử nghiệm không đúng định dạng');
  });

  it('lets the user open booking flow and create a ticket', async () => {
    const api = createApi();
    renderApp(api);

    await openBookingForm();
    expect(api.getServices).toHaveBeenCalledWith('loc-001', 'area-justice', expect.any(AbortSignal));
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt số' }));

    await waitFor(() =>
      expect(api.createBooking).toHaveBeenCalledWith({
        locationId: 'loc-001',
        areaId: 'area-justice',
        serviceId: 'svc-justice-1',
        fullName: 'Nguyễn Văn A',
        bookingDate: expect.any(String),
      }, expect.any(AbortSignal)),
    );
    expect(await screen.findByRole('heading', { name: /Phiếu đăng ký/ })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Mã QR của phiếu' })).toBeTruthy();
    expect(screen.getByText('#0002')).toBeTruthy();
  });

  it('shows current booking and history', async () => {
    const api = createApi();
    renderApp(api);

    fireEvent.click(await screen.findByRole('button', { name: /Số đã đặt/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Lịch sử đặt số' })).toBeTruthy();
    expect(screen.getAllByText('#0001')).toHaveLength(2);
  });

  it('shows queue status and waiting tickets', async () => {
    const api = createApi();
    renderApp(api);

    fireEvent.click(await screen.findByRole('button', { name: /Tình hình số thứ tự/ }));
    expect(await screen.findByText('Tình hình số thứ tự')).toBeTruthy();
  });

  it('rejects malformed schema without confusing it with network failure', async () => {
    const api = createApi({
      getLocations: vi.fn(async () => {
        throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu địa điểm không hợp lệ.');
      }),
    });
    renderApp(api);
    expect((await screen.findByRole('alert')).textContent).toContain('Dữ liệu từ máy chủ thử nghiệm không đúng định dạng');
  });

  it('validates the booking name/date and resets downstream selection when location changes', async () => {
    const api = createApi();
    renderApp(api);
    await openBookingForm();

    const dateButtons = screen.getAllByRole('button').filter((button) => button.classList.contains('date-chip'));
    const yesterday = dateButtons.find((button) => button.hasAttribute('disabled'));
    expect(yesterday).toBeTruthy();
    const futureDate = dateButtons.find((button) => !button.hasAttribute('disabled') && button.getAttribute('aria-pressed') === 'false');
    expect(futureDate).toBeTruthy();
    fireEvent.click(futureDate!);
    await waitFor(() => expect(futureDate?.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByRole('button', { name: 'Xác nhận đặt số' }).hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn A' } });
    expect(screen.getByRole('button', { name: 'Xác nhận đặt số' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(LOCATIONS[1]!.locationName) }));
    expect(await screen.findByRole('button', { name: 'Xác nhận đặt số' })).toHaveProperty('disabled', true);
    expect(api.getServices).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate booking submission and supports confirmed cancellation', async () => {
    let resolveBooking: ((ticket: QmsTicketDto) => void) | undefined;
    const createBooking = vi.fn(
      () =>
        new Promise<QmsTicketDto>((resolve) => {
          resolveBooking = resolve;
        }),
    );
    const api = createApi({ createBooking });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(api);
    await openBookingForm();
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn A' } });
    const submit = screen.getByRole('button', { name: 'Xác nhận đặt số' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(createBooking).toHaveBeenCalledTimes(1);
    resolveBooking?.(createTicket());
    expect(await screen.findByRole('button', { name: 'Hủy lượt' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy lượt' }));
    await waitFor(() => expect(api.cancelTicket).toHaveBeenCalledWith('ticket-demo-001', expect.any(AbortSignal)));
  });

  it('handles browser back and aborts active API signals on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    const api = createApi({
      getLocations: vi.fn(async (signal?: AbortSignal) => {
        capturedSignal = signal;
        return LOCATIONS;
      }),
    });
    const rendered = renderApp(api);
    fireEvent.click(await screen.findByRole('button', { name: /Đặt số trực tuyến/ }));
    window.dispatchEvent(new PopStateEvent('popstate', { state: { qmsScreen: 'home' } }));
    expect(await screen.findByRole('heading', { name: APP_NAME })).toBeTruthy();
    rendered.unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('uses a full-width location layout without break-all and removes step labels', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Đặt số trực tuyến/ }));
    const locationCard = await screen.findByRole('button', { name: new RegExp(LOCATIONS[0]!.locationName) });

    expect(locationCard.classList.contains('location-card')).toBe(true);
    expect(locationCard.className).not.toMatch(/break-all/i);
    expect(locationCard.getAttribute('style')).toBeNull();
    expect(document.body.textContent?.toUpperCase()).not.toContain('BƯỚC');
  });

  it('shows service schema errors in the service section', async () => {
    const api = createApi({
      getServices: vi.fn(async () => {
        throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu dịch vụ không hợp lệ.');
      }),
    });
    renderApp(api);
    fireEvent.click(await screen.findByRole('button', { name: /Đặt số trực tuyến/ }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(LOCATIONS[0]!.locationName) }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(AREAS[0]!.areaName) }));

    const alert = await screen.findByRole('alert');
    expect(alert.closest('.section-block')?.textContent).toContain('Dịch vụ');
    expect(alert.textContent).toContain('Dữ liệu từ máy chủ thử nghiệm không đúng định dạng');
  });

  it('unlocks submit after a server rejection and shows the server error', async () => {
    const api = createApi({
      createBooking: vi.fn(async () => {
        throw new QmsApiError('HTTP_ERROR', 'Dịch vụ không còn nhận đặt số.', 409, 'BOOKING_CLOSED');
      }),
    });
    renderApp(api);
    await openBookingForm();
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt số' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Dịch vụ không còn nhận đặt số.');
    expect(screen.getByRole('button', { name: 'Xác nhận đặt số' }).hasAttribute('disabled')).toBe(false);
  });
});
