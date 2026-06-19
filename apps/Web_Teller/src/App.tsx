import { createApiClient, type ApiClient } from '@qms/api-client';
import type {
  ApiResponse,
  CounterSession,
  DashboardSummaryResponse,
  QueueSummary,
  StaffId,
  Ticket,
  User,
} from '@qms/contracts';
import { FormEvent, useMemo, useState } from 'react';

import './styles.css';

export const APP_NAME = 'Web_Teller';

const DEFAULT_LOCAL_API_URL = 'http://localhost:3100/api/v1';
const TOKEN_STORAGE_KEY = 'qms-web-teller-mock-access-token';

// BACKEND_CONFIRMATION_REQUIRED: Counter/service discovery endpoints are not confirmed.
// These development-only choices match Mock Local Server seed identifiers.
const DEMO_COUNTERS = [
  { id: 'counter-demo-001', name: 'Quầy Demo 01', serviceId: 'service-demo-001' },
  { id: 'counter-demo-002', name: 'Quầy Demo 02', serviceId: 'service-demo-002' },
] as const;

function usesSessionAuthStorage(): boolean {
  return import.meta.env.VITE_AUTH_STORAGE === 'session';
}

/**
 * DEVELOPMENT_ONLY / BACKEND_CONFIRMATION_REQUIRED: Login does not expose staffId yet.
 * Keep the temporary mock-user mapping in one place until Backend confirms the identity link.
 */
function resolveDevelopmentStaffId(user: User): StaffId {
  return user.id === 'user-demo-local-001' ? 'staff-demo-001' : `staff-development-${user.id}`;
}

type AuthApi = Pick<ApiClient['authClient'], 'login' | 'logout'>;
type CounterSessionApi = Pick<
  ApiClient['counterSessionClient'],
  'startCounterSession' | 'getActiveCounterSession' | 'endCounterSession'
>;
type QueueApi = Pick<
  ApiClient['queueClient'],
  | 'getWaitingQueue'
  | 'callNext'
  | 'recallTicket'
  | 'skipTicket'
  | 'transferTicket'
  | 'finishTicket'
  | 'createAssistedTicket'
>;
type DashboardApi = Pick<ApiClient['dashboardClient'], 'getDashboardSummary'>;

export interface WebTellerApi {
  readonly authClient: AuthApi;
  readonly counterSessionClient: CounterSessionApi;
  readonly queueClient: QueueApi;
  readonly dashboardClient: DashboardApi;
}

export interface AppProps {
  readonly apiClient?: WebTellerApi;
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.error.message);
  }
  return response.data;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi không xác định. Vui lòng thử lại.';
}

function readStoredToken(): string | null {
  return usesSessionAuthStorage() ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
}

export function App({ apiClient: injectedApiClient }: AppProps) {
  const [accessToken, setAccessToken] = useState<string | null>(readStoredToken);
  const [user, setUser] = useState<User | null>(null);
  const [selectedCounterId, setSelectedCounterId] = useState<string>(DEMO_COUNTERS[0].id);
  const [session, setSession] = useState<CounterSession | null>(null);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [waitingTickets, setWaitingTickets] = useState<readonly Ticket[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [isCurrentTicketUnknown, setIsCurrentTicketUnknown] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  const apiClient = useMemo<WebTellerApi>(
    () =>
      injectedApiClient ??
      createApiClient({
        baseUrl: import.meta.env.VITE_LOCAL_API_URL ?? DEFAULT_LOCAL_API_URL,
        getAccessToken: () => accessToken,
        timeoutMs: 10_000,
      }),
    [accessToken, injectedApiClient],
  );

  const selectedCounter =
    DEMO_COUNTERS.find((counter) => counter.id === selectedCounterId) ?? DEMO_COUNTERS[0];

  async function runAction(actionName: string, action: () => Promise<void>): Promise<void> {
    setBusyAction(actionName);
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshQueue(locationId: string) {
    const waiting = unwrap(
      await apiClient.queueClient.getWaitingQueue({
        locationId,
        pagination: { page: 1, pageSize: 50 },
      }),
    );
    setWaitingTickets(waiting.queue.items);
    setSummary(waiting.summary);
    return waiting;
  }

  async function refreshDashboard(locationId: string): Promise<DashboardSummaryResponse> {
    const dashboard = unwrap(await apiClient.dashboardClient.getDashboardSummary({ locationId }));
    setSummary(dashboard.queue);
    return dashboard;
  }

  function handleLogin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username') ?? '');
    const password = String(formData.get('password') ?? '');

    void runAction('Đang đăng nhập...', async () => {
      const login = unwrap(await apiClient.authClient.login({ username, password }));
      if (usesSessionAuthStorage()) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, login.accessToken);
      }
      setAccessToken(login.accessToken);
      setUser(login.user);
    });
  }

  function handleStartSession(): void {
    if (user === null) {
      return;
    }
    void runAction('Đang bắt đầu ca...', async () => {
      const active = unwrap(
        await apiClient.counterSessionClient.getActiveCounterSession({
          locationId: user.locationId,
          counterId: selectedCounter.id,
        }),
      );
      const nextSession =
        active.session ??
        unwrap(
          await apiClient.counterSessionClient.startCounterSession({
            locationId: user.locationId,
            counterId: selectedCounter.id,
            staffId: resolveDevelopmentStaffId(user),
          }),
        ).session;
      setSession(nextSession);
      const [waiting, dashboard] = await Promise.all([
        refreshQueue(user.locationId),
        refreshDashboard(user.locationId),
      ]);

      if (active.session !== null) {
        // BACKEND_CONFIRMATION_REQUIRED: Dashboard only exposes currentTicketId. Until a
        // confirmed ticket snapshot endpoint exists, use queue data when it contains the ID
        // and otherwise show an explicit unknown state instead of claiming the counter is empty.
        const counterSnapshot = dashboard.counters.find(
          (counter) => counter.id === nextSession.counterId,
        );
        const restoredTicket =
          counterSnapshot?.currentTicketId === undefined
            ? undefined
            : waiting.queue.items.find((ticket) => ticket.id === counterSnapshot.currentTicketId);
        setCurrentTicket(restoredTicket ?? null);
        setIsCurrentTicketUnknown(
          counterSnapshot === undefined ||
            (counterSnapshot.currentTicketId !== undefined && restoredTicket === undefined),
        );
        setQueueMessage('Đã khôi phục ca làm việc.');
      } else {
        setCurrentTicket(null);
        setIsCurrentTicketUnknown(false);
        setQueueMessage(null);
      }
    });
  }

  function handleLogout(): void {
    void runAction('Đang đăng xuất...', async () => {
      try {
        unwrap(await apiClient.authClient.logout({}));
      } finally {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setAccessToken(null);
        setUser(null);
      }
    });
  }

  function handleCallNext(): void {
    if (user === null || session === null) {
      return;
    }
    void runAction('Đang gọi số tiếp theo...', async () => {
      const result = unwrap(
        await apiClient.queueClient.callNext({
          locationId: user.locationId,
          counterId: session.counterId,
          sessionId: session.id,
        }),
      );
      setCurrentTicket(result.ticket);
      setIsCurrentTicketUnknown(false);
      setSummary(result.summary);
      setQueueMessage(result.ticket === null ? 'Đã hết hàng chờ.' : null);
      await refreshQueue(user.locationId);
    });
  }

  function handleTicketAction(action: 'recall' | 'skip' | 'transfer' | 'finish'): void {
    if (user === null || session === null || currentTicket === null) {
      return;
    }
    const common = {
      locationId: user.locationId,
      counterId: session.counterId,
      sessionId: session.id,
      ticketId: currentTicket.id,
    };
    const labels = {
      recall: 'Đang gọi lại...',
      skip: 'Đang bỏ qua...',
      transfer: 'Đang chuyển quầy...',
      finish: 'Đang hoàn thành...',
    } as const;

    void runAction(labels[action], async () => {
      if (action === 'recall') {
        const result = unwrap(await apiClient.queueClient.recallTicket(common));
        setCurrentTicket(result.ticket);
        return;
      }
      if (action === 'skip') {
        const result = unwrap(await apiClient.queueClient.skipTicket(common));
        setSummary(result.summary);
      } else if (action === 'transfer') {
        const target = DEMO_COUNTERS.find((counter) => counter.id !== session.counterId);
        if (target === undefined) {
          throw new Error('Không có quầy đích khả dụng.');
        }
        unwrap(
          await apiClient.queueClient.transferTicket({
            locationId: user.locationId,
            ticketId: currentTicket.id,
            fromCounterId: session.counterId,
            toCounterId: target.id,
            sessionId: session.id,
          }),
        );
      } else {
        unwrap(await apiClient.queueClient.finishTicket(common));
      }
      setCurrentTicket(null);
      setIsCurrentTicketUnknown(false);
      await refreshQueue(user.locationId);
    });
  }

  function handleAssistedTicket(): void {
    if (user === null || session === null) {
      return;
    }
    void runAction('Đang lấy số hộ...', async () => {
      const result = unwrap(
        await apiClient.queueClient.createAssistedTicket({
          locationId: user.locationId,
          serviceId: selectedCounter.serviceId,
          staffId: session.staffId,
          sessionId: session.id,
          counterId: session.counterId,
        }),
      );
      setQueueMessage(`Đã tạo số ${result.ticket.ticketNumber}.`);
      await refreshQueue(user.locationId);
    });
  }

  function handleEndSession(): void {
    if (user === null || session === null) {
      return;
    }
    void runAction('Đang kết thúc ca...', async () => {
      unwrap(
        await apiClient.counterSessionClient.endCounterSession({
          locationId: user.locationId,
          sessionId: session.id,
        }),
      );
      setSession(null);
      setCurrentTicket(null);
      setIsCurrentTicketUnknown(false);
      setWaitingTickets([]);
      setSummary(null);
      setQueueMessage(null);
    });
  }

  if (user === null) {
    return (
      <main className="page centered">
        <section className="panel auth-panel">
          <p className="eyebrow">QMS Local</p>
          <h1>{APP_NAME}</h1>
          <p>Đăng nhập để bắt đầu làm việc tại quầy.</p>
          <p className="notice">Mock auth chỉ dùng cho môi trường development.</p>
          <form onSubmit={handleLogin}>
            <label>
              Tên đăng nhập
              <input name="username" required autoComplete="username" />
            </label>
            <label>
              Mật khẩu
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <button type="submit" disabled={busyAction !== null}>
              Đăng nhập
            </button>
          </form>
          {busyAction !== null && <p role="status">{busyAction}</p>}
          {error !== null && <p role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  if (session === null) {
    return (
      <main className="page centered">
        <section className="panel auth-panel">
          <p className="eyebrow">Xin chào, {user.displayName}</p>
          <h1>Chọn quầy làm việc</h1>
          <label>
            Quầy
            <select
              value={selectedCounterId}
              onChange={(event) => setSelectedCounterId(event.target.value)}
            >
              {DEMO_COUNTERS.map((counter) => (
                <option key={counter.id} value={counter.id}>
                  {counter.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleStartSession} disabled={busyAction !== null}>
            Bắt đầu ca
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleLogout}
            disabled={busyAction !== null}
          >
            Đăng xuất
          </button>
          {busyAction !== null && <p role="status">{busyAction}</p>}
          {error !== null && <p role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">{APP_NAME}</p>
          <h1>{selectedCounter.name}</h1>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={handleEndSession}
          disabled={busyAction !== null}
        >
          Kết thúc ca
        </button>
      </header>

      {busyAction !== null && (
        <p role="status" className="notice">
          {busyAction}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {queueMessage !== null && (
        <p role="status" className="notice">
          {queueMessage}
        </p>
      )}

      <section className="summary-grid" aria-label="Thông tin ca">
        <article className="panel">
          <span>Cán bộ</span>
          <strong>{user.displayName}</strong>
        </article>
        <article className="panel">
          <span>Trạng thái ca</span>
          <strong>{session.status}</strong>
        </article>
        <article className="panel">
          <span>Số đang xử lý</span>
          <strong>
            {currentTicket?.ticketNumber ??
              (isCurrentTicketUnknown ? 'Chưa có thông tin' : 'Chưa có')}
          </strong>
        </article>
        <article className="panel">
          <span>Người đang chờ</span>
          <strong>{summary?.waitingCount ?? waitingTickets.length}</strong>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>Ticket hiện tại</h2>
          {currentTicket === null ? (
            <p>
              {isCurrentTicketUnknown
                ? 'Chưa có thông tin ticket đang xử lý.'
                : 'Chưa có ticket đang xử lý.'}
            </p>
          ) : (
            <div className="ticket-number">{currentTicket.ticketNumber}</div>
          )}
          <div className="actions">
            <button type="button" onClick={handleCallNext} disabled={busyAction !== null}>
              Gọi số tiếp theo
            </button>
            <button
              type="button"
              onClick={() => handleTicketAction('recall')}
              disabled={busyAction !== null || currentTicket === null}
            >
              Gọi lại
            </button>
            <button
              type="button"
              onClick={() => handleTicketAction('skip')}
              disabled={busyAction !== null || currentTicket === null}
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={() => handleTicketAction('transfer')}
              disabled={busyAction !== null || currentTicket === null}
            >
              Chuyển quầy
            </button>
            <button
              type="button"
              onClick={() => handleTicketAction('finish')}
              disabled={busyAction !== null || currentTicket === null}
            >
              Hoàn thành
            </button>
            <button type="button" onClick={handleAssistedTicket} disabled={busyAction !== null}>
              Lấy số hộ
            </button>
          </div>
        </article>

        <article className="panel">
          <h2>Danh sách chờ</h2>
          {waitingTickets.length === 0 ? (
            <p>Không có người đang chờ.</p>
          ) : (
            <ul className="waiting-list">
              {waitingTickets.map((ticket) => (
                <li key={ticket.id}>
                  <strong>{ticket.ticketNumber}</strong>
                  <span>{ticket.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
