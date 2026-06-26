// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import type { QmsApiClient, QmsService, QmsTicket } from './qms-api';

const SERVICES: readonly QmsService[] = [
  { id: 'medical', code: 'A', name: 'Khám bệnh' },
  { id: 'payment', code: 'B', name: 'Thanh toán' },
  { id: 'consulting', code: 'C', name: 'Tư vấn' },
];

function createTicket(overrides: Partial<QmsTicket> = {}): QmsTicket {
  return {
    ticketId: 'ticket-demo-001',
    ticketNumber: 'A001',
    serviceId: 'medical',
    serviceName: 'Khám bệnh',
    status: 'WAITING',
    waitingAhead: 3,
    createdAt: '2026-06-26T00:00:00.000Z',
    ...overrides,
  };
}

function createApi(overrides: Partial<QmsApiClient> = {}): QmsApiClient {
  return {
    getServices: vi.fn(async () => SERVICES),
    createTicket: vi.fn(async () => createTicket()),
    getTicket: vi.fn(async () => createTicket()),
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

describe('Zalo App QMS MVP', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Vietnamese app shell and empty state', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Tuan QMS' })).toBeTruthy();
    expect(screen.getByText('Zalo Mini App lấy số thứ tự')).toBeTruthy();
    expect(screen.getByText('Chưa có lượt đang chờ')).toBeTruthy();
    expect(await screen.findByRole('radio', { name: /Khám bệnh/ })).toBeTruthy();
  });

  it('does not create a ticket before selecting a service', async () => {
    const api = createApi();
    renderApp(api);

    const button = await screen.findByRole('button', { name: 'Lấy số thứ tự' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(api.createTicket).not.toHaveBeenCalled();
  });

  it('creates a ticket after service selection', async () => {
    const api = createApi();
    renderApp(api);

    fireEvent.click(await screen.findByRole('radio', { name: /Khám bệnh/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));

    await waitFor(() => expect(api.createTicket).toHaveBeenCalledWith('medical', expect.any(AbortSignal)));
    expect(await screen.findByRole('heading', { name: 'A001' })).toBeTruthy();
    expect(screen.getByText('Đang chờ')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('updates ticket status from the API', async () => {
    const api = createApi({
      getTicket: vi.fn(async () => createTicket({ status: 'CALLED', waitingAhead: 0 })),
    });
    renderApp(api);

    fireEvent.click(await screen.findByRole('radio', { name: /Khám bệnh/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lấy số thứ tự' }));
    await screen.findByRole('heading', { name: 'A001' });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật trạng thái' }));

    await waitFor(() => expect(api.getTicket).toHaveBeenCalledWith('ticket-demo-001', expect.any(AbortSignal)));
    expect(await screen.findByText('Đã được gọi')).toBeTruthy();
  });

  it('shows a clear connection error when API fails', async () => {
    const api = createApi({
      getServices: vi.fn(async () => {
        throw new Error('Không kết nối được máy chủ thử nghiệm.');
      }),
    });
    renderApp(api);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Không kết nối được máy chủ thử nghiệm');
  });

  it('does not render PII fields', async () => {
    renderApp();

    await screen.findByRole('radio', { name: /Khám bệnh/ });
    expect(document.body.textContent).not.toMatch(/cccd|phone|email|số điện thoại/i);
  });
});
