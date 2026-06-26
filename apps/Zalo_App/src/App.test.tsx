// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { QmsApiError } from './qms-api';
import type { QmsBookingApiClient, QmsLocation, QmsQueueStatus, QmsService, QmsTicket } from './qms-api';

const LOCATIONS: readonly QmsLocation[] = [
  {
    locationId: 'loc-001',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA',
    address: '123 Đường Demo, Xã Cư Mta',
  },
  {
    locationId: 'loc-002',
    locationName: 'AIoT Making Innovation',
    address: 'Khu thử nghiệm AIoT, TP. Hồ Chí Minh',
  },
];

const SERVICES: readonly QmsService[] = [
  {
    serviceId: 'svc-med',
    serviceCode: 'A',
    serviceName: 'Khám bệnh',
    description: 'Dịch vụ khám tổng quát',
    bookingEnabled: true,
  },
  {
    serviceId: 'svc-pay',
    serviceCode: 'B',
    serviceName: 'Thanh toán',
    description: 'Thanh toán phí dịch vụ',
    bookingEnabled: true,
  },
];

const FIRST_LOCATION = LOCATIONS[0]!;
const FIRST_SERVICE = SERVICES[0]!;

function createTicket(overrides: Partial<QmsTicket> = {}): QmsTicket {
  return {
    ticketId: 'ticket-demo-001',
    ticketNumber: '0011',
    locationId: FIRST_LOCATION.locationId,
    locationName: FIRST_LOCATION.locationName,
    serviceId: FIRST_SERVICE.serviceId,
    serviceName: FIRST_SERVICE.serviceName,
    status: 'WAITING',
    createdAt: '2026-06-26T00:00:00.000Z',
    updatedAt: '2026-06-26T00:05:00.000Z',
    checkInExpiresAt: '2026-06-26T01:00:00.000Z',
    qrPayload: 'qms-booking-demo-payload',
    canCancel: true,
    ...overrides,
  };
}

function createQueueStatus(): QmsQueueStatus {
  return {
    locationId: FIRST_LOCATION.locationId,
    locationName: FIRST_LOCATION.locationName,
    bookingEnabled: true,
    currentDate: '2026-06-26T00:10:00.000Z',
    counters: [
      {
        counterId: 'counter-01',
        counterName: 'Quầy 01',
        status: 'OPEN',
        currentTicketNumber: '0011',
        servingServiceName: 'Khám bệnh',
        updatedAt: '2026-06-26T00:10:00.000Z',
      },
      {
        counterId: 'counter-02',
        counterName: 'Quầy 02',
        status: 'OPEN',
        currentTicketNumber: null,
        servingServiceName: null,
        updatedAt: '2026-06-26T00:10:00.000Z',
      },
    ],
    waitingTickets: [createTicket()],
  };
}

function createApi(overrides: Partial<QmsBookingApiClient> = {}): QmsBookingApiClient {
  return {
    getLocations: vi.fn(async () => LOCATIONS),
    getLocation: vi.fn(async (locationId: string) => {
      const location = LOCATIONS.find((item) => item.locationId === locationId);
      if (location === undefined) {
        throw new Error('Not found');
      }
      return location;
    }),
    getServices: vi.fn(async () => SERVICES),
    createTicket: vi.fn(async () => createTicket()),
    listTickets: vi.fn(async () => []),
    getTicket: vi.fn(async () => createTicket({ status: 'CALLED' })),
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
      <App
        apiClient={api}
        initializeRuntime={async () => ({ phase: 'ready', runtime: 'browser-development' })}
      />
    </StrictMode>,
  );
}

describe('Zalo App booking flow', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the home menu and brand sections', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Tuan QMS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Đặt số trực tuyến/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Số đã đặt/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tình hình số thứ tự/ })).toBeTruthy();
    expect(screen.getByText('OA chính thức của đơn vị')).toBeTruthy();
    expect(screen.getByText('Danh bạ')).toBeTruthy();
  });

  it('shows a schema error when the server response is malformed', async () => {
    const api = createApi({
      getLocations: vi.fn(async () => {
        throw new QmsApiError('INVALID_RESPONSE', 'Dữ liệu địa điểm không hợp lệ.');
      }),
    });
    renderApp(api);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Dữ liệu từ máy chủ thử nghiệm không đúng định dạng');
    expect(alert.textContent).not.toContain('Không kết nối được máy chủ thử nghiệm');
  });

  it('walks through booking creation and shows the booked detail', async () => {
    const api = createApi({
      createTicket: vi.fn(async () =>
        createTicket({
          ticketId: 'ticket-demo-011',
          ticketNumber: '0011',
          locationId: FIRST_LOCATION.locationId,
          locationName: FIRST_LOCATION.locationName,
          serviceId: FIRST_SERVICE.serviceId,
          serviceName: FIRST_SERVICE.serviceName,
          qrPayload: 'booking-qr-demo',
        }),
      ),
    });
    renderApp(api);

    fireEvent.click(await screen.findByRole('button', { name: /Đặt số trực tuyến/ }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(FIRST_LOCATION.locationName) }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(FIRST_SERVICE.serviceName) }));
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));

    await waitFor(() =>
      expect(api.createTicket).toHaveBeenCalledWith({
        locationId: FIRST_LOCATION.locationId,
        serviceId: FIRST_SERVICE.serviceId,
      }),
    );
    expect(await screen.findByRole('heading', { name: '#0011' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Mã QR của booking' })).toBeTruthy();
    expect(screen.getByText(FIRST_LOCATION.locationName)).toBeTruthy();
    expect(screen.getByText(FIRST_SERVICE.serviceName)).toBeTruthy();
  });

  it('shows the booked list empty state', async () => {
    const api = createApi({ listTickets: vi.fn(async () => []) });
    renderApp(api);

    fireEvent.click(await screen.findByRole('button', { name: /Số đã đặt/ }));

    expect(await screen.findByText('Bạn chưa có số đã đặt')).toBeTruthy();
    expect(api.listTickets).toHaveBeenCalled();
  });

  it('shows queue status and waiting tickets', async () => {
    const api = createApi({ getQueueStatus: vi.fn(async () => createQueueStatus()) });
    renderApp(api);

    fireEvent.click(await screen.findByRole('button', { name: /Tình hình số thứ tự/ }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(FIRST_LOCATION.locationName) }));

    expect(await screen.findByText('Trạng thái hiện tại')).toBeTruthy();
    expect(screen.getByText('Danh sách quầy')).toBeTruthy();
    expect(screen.getByText('Danh sách chờ')).toBeTruthy();
    expect(screen.getByText('#0011')).toBeTruthy();
  });

  it('shows a clear error state when the API fails', async () => {
    const api = createApi({
      getLocations: vi.fn(async () => {
        throw new Error('Không kết nối được máy chủ thử nghiệm.');
      }),
    });
    renderApp(api);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Không kết nối được máy chủ thử nghiệm');
  });

  it('supports mock case lookup without PII', async () => {
    renderApp();

    fireEvent.click(await screen.findByRole('button', { name: /Tra cứu hồ sơ/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(screen.getByText('Vui lòng nhập mã hồ sơ.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Mã hồ sơ'), { target: { value: 'HS-2026-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));

    expect(await screen.findByText('Dữ liệu mô phỏng')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/cccd|phone|email|số điện thoại/i);
  });
});
