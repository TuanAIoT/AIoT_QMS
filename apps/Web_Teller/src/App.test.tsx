// @vitest-environment jsdom

import type { CounterSession, LoginApiResponse, QueueSummary, Ticket, User } from '@qms/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App, APP_NAME, type WebTellerApi } from './App';

const USER: User = {
  id: 'user-demo-local-001',
  username: 'demo',
  displayName: 'Development Demo User',
  locationId: 'location-demo-001',
  roles: ['TELLER'],
  isActive: true,
};

const SESSION: CounterSession = {
  id: 'session-demo-001',
  locationId: USER.locationId,
  counterId: 'counter-demo-001',
  staffId: 'staff-demo-001',
  startedAt: '2026-06-19T08:00:00.000Z',
  status: 'ACTIVE',
  ticketsServed: 0,
};

const SUMMARY: QueueSummary = {
  locationId: USER.locationId,
  waitingCount: 1,
  calledCount: 0,
  servingCount: 0,
  skippedCount: 0,
  updatedAt: '2026-06-19T08:00:00.000Z',
};

const TICKET: Ticket = {
  id: 'ticket-demo-001',
  locationId: USER.locationId,
  ticketNumber: 'A-001',
  serviceId: 'service-demo-001',
  status: 'CALLED',
  source: 'KIOSK',
  priorityLevel: 0,
  issuedAt: '2026-06-19T08:01:00.000Z',
};

function success<T>(data: T) {
  return { success: true, data } as const;
}

function createMockApi(): WebTellerApi {
  return {
    authClient: {
      login: vi.fn(() =>
        Promise.resolve<LoginApiResponse>(
          success({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            accessTokenExpiresAt: '2026-06-19T09:00:00.000Z',
            user: USER,
          }),
        ),
      ),
      logout: vi.fn(() => Promise.resolve(success({ loggedOut: true }))),
    },
    counterSessionClient: {
      getActiveCounterSession: vi.fn(() => Promise.resolve(success({ session: SESSION }))),
      startCounterSession: vi.fn(() => Promise.resolve(success({ session: SESSION }))),
      endCounterSession: vi.fn(() => Promise.resolve(success({ session: SESSION }))),
    },
    queueClient: {
      getWaitingQueue: vi.fn(() =>
        Promise.resolve(
          success({
            queue: {
              items: [TICKET],
              totalItems: 1,
              page: 1,
              pageSize: 50,
              totalPages: 1,
            },
            summary: SUMMARY,
          }),
        ),
      ),
      callNext: vi.fn(() => Promise.resolve(success({ ticket: TICKET, summary: SUMMARY }))),
      recallTicket: vi.fn(() => Promise.resolve(success({ ticket: TICKET }))),
      skipTicket: vi.fn(() => Promise.resolve(success({ ticket: TICKET, summary: SUMMARY }))),
      transferTicket: vi.fn(() => Promise.resolve(success({ ticket: TICKET }))),
      finishTicket: vi.fn(() => Promise.resolve(success({ ticket: TICKET }))),
      createAssistedTicket: vi.fn(() => Promise.resolve(success({ ticket: TICKET }))),
    },
    dashboardClient: {
      getDashboardSummary: vi.fn(() =>
        Promise.resolve(
          success({ queue: SUMMARY, counters: [], devices: [], updatedAt: SUMMARY.updatedAt }),
        ),
      ),
    },
  };
}

async function login(apiClient: WebTellerApi): Promise<void> {
  render(<App apiClient={apiClient} />);
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'demo' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'demo-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  await screen.findByRole('heading', { name: 'Chọn quầy làm việc' });
}

async function startSession(apiClient: WebTellerApi): Promise<void> {
  await login(apiClient);
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ca' }));
  await screen.findByRole('button', { name: 'Gọi số tiếp theo' });
}

describe(APP_NAME, () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => cleanup());

  it('renders the login screen', () => {
    render(<App apiClient={createMockApi()} />);

    expect(screen.getByRole('heading', { name: APP_NAME })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('moves to counter selection after a successful login', async () => {
    await login(createMockApi());

    expect(screen.getByLabelText('Quầy')).toBeTruthy();
  });

  it('shows an error when login fails', async () => {
    const apiClient = createMockApi();
    vi.mocked(apiClient.authClient.login).mockRejectedValueOnce(new Error('Sai tài khoản.'));
    render(<App apiClient={apiClient} />);

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Sai tài khoản.');
  });

  it('calls api-client callNext and renders the returned ticket number', async () => {
    const apiClient = createMockApi();
    await startSession(apiClient);

    fireEvent.click(screen.getByRole('button', { name: 'Gọi số tiếp theo' }));

    await waitFor(() => expect(apiClient.queueClient.callNext).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText(TICKET.ticketNumber)).length).toBeGreaterThan(0);
  });

  it('shows an empty queue message when callNext returns null', async () => {
    const apiClient = createMockApi();
    vi.mocked(apiClient.queueClient.callNext).mockResolvedValueOnce(
      success({ ticket: null, summary: { ...SUMMARY, waitingCount: 0 } }),
    );
    await startSession(apiClient);

    fireEvent.click(screen.getByRole('button', { name: 'Gọi số tiếp theo' }));

    expect(await screen.findByText('Đã hết hàng chờ.')).toBeTruthy();
  });

  it('shows loading while a request is pending', async () => {
    const apiClient = createMockApi();
    let resolveLogin: ((response: LoginApiResponse) => void) | undefined;
    vi.mocked(apiClient.authClient.login).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    render(<App apiClient={apiClient} />);

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByRole('status')).toHaveProperty('textContent', 'Đang đăng nhập...');
    resolveLogin?.(
      success({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        accessTokenExpiresAt: '2026-06-19T09:00:00.000Z',
        user: USER,
      }),
    );
    await screen.findByRole('heading', { name: 'Chọn quầy làm việc' });
  });

  it('does not call fetch directly from the React component', () => {
    expect(App.toString()).not.toContain('fetch(');
  });
});
