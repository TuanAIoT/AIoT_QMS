import { useCallback, useEffect, useMemo, useState } from 'react';

import { createQmsApiClient, QmsApiError, type QmsApiClient, type QmsService, type QmsTicket } from './qms-api';
import { getRuntimeConfig, initializeZaloRuntime, type ZaloRuntimeState } from './runtime';
import './styles.css';

export const APP_NAME = 'Tuan QMS';

export interface AppProps {
  readonly apiClient?: QmsApiClient;
  readonly initializeRuntime?: () => Promise<ZaloRuntimeState>;
}

function statusLabel(status: QmsTicket['status']): string {
  return status === 'WAITING' ? 'Đang chờ' : 'Đã được gọi';
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof QmsApiError) {
    return error.message;
  }
  return 'Không kết nối được máy chủ thử nghiệm.';
}

function RuntimeBanner({ state }: { readonly state: ZaloRuntimeState }) {
  if (state.phase === 'initializing') {
    return <p role="status">Đang khởi tạo Zalo Mini App...</p>;
  }
  if (state.phase === 'configuration-error') {
    return <p role="alert">Cấu hình Zalo Mini App chưa đầy đủ.</p>;
  }
  if (state.phase === 'unsupported') {
    return <p role="alert">Môi trường hiện tại chưa được hỗ trợ.</p>;
  }
  return (
    <p role="status">
      {state.runtime === 'zalo-mini-app'
        ? 'Đang chạy trong Zalo Mini App.'
        : 'Chế độ phát triển trên trình duyệt.'}
    </p>
  );
}

export function App({ apiClient, initializeRuntime }: AppProps = {}) {
  const api = useMemo(() => apiClient ?? createQmsApiClient(), [apiClient]);
  const [runtimeState, setRuntimeState] = useState<ZaloRuntimeState>({ phase: 'initializing' });
  const [services, setServices] = useState<readonly QmsService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<QmsService['id'] | ''>('');
  const [ticket, setTicket] = useState<QmsTicket | null>(null);
  const [loadingAction, setLoadingAction] = useState<'services' | 'create' | 'status' | null>(
    'services',
  );
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLoadingAction('services');
      setError(null);
      try {
        const loaded = await api.getServices(signal);
        setServices(loaded);
      } catch (caught) {
        if (signal?.aborted !== true) {
          setError(safeErrorMessage(caught));
        }
      } finally {
        if (signal?.aborted !== true) {
          setLoadingAction(null);
        }
      }
    },
    [api],
  );

  useEffect(() => {
    let active = true;
    const init = initializeRuntime ?? (() => initializeZaloRuntime(getRuntimeConfig()));
    void init()
      .then((state) => {
        if (active) {
          setRuntimeState(state);
        }
      })
      .catch(() => {
        if (active) {
          setRuntimeState({ phase: 'unsupported' });
        }
      });
    return () => {
      active = false;
    };
  }, [initializeRuntime]);

  useEffect(() => {
    const controller = new AbortController();
    void loadServices(controller.signal);
    return () => controller.abort();
  }, [loadServices]);

  const selectedService = services.find((service) => service.id === selectedServiceId);
  const busy = loadingAction !== null;

  const handleCreateTicket = async (): Promise<void> => {
    if (selectedServiceId === '' || busy) {
      return;
    }
    const controller = new AbortController();
    setLoadingAction('create');
    setError(null);
    try {
      setTicket(await api.createTicket(selectedServiceId, controller.signal));
    } catch (caught) {
      setError(safeErrorMessage(caught));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefreshStatus = async (): Promise<void> => {
    if (ticket === null || busy) {
      return;
    }
    const controller = new AbortController();
    setLoadingAction('status');
    setError(null);
    try {
      setTicket(await api.getTicket(ticket.ticketId, controller.signal));
    } catch (caught) {
      setError(safeErrorMessage(caught));
    } finally {
      setLoadingAction(null);
    }
  };

  const resetCurrentTicket = (): void => {
    setTicket(null);
    setError(null);
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Zalo Mini App</p>
          <h1>{APP_NAME}</h1>
          <p>Zalo Mini App lấy số thứ tự</p>
        </div>
        <span className="mock-badge">Mock API</span>
      </header>

      <section className="runtime-card" aria-label="Trạng thái runtime">
        <RuntimeBanner state={runtimeState} />
      </section>

      {error !== null ? (
        <section className="error-card" role="alert">
          <strong>Không kết nối được máy chủ thử nghiệm</strong>
          <p>{error}</p>
          <button type="button" onClick={() => void loadServices()} disabled={busy}>
            Thử tải lại dịch vụ
          </button>
        </section>
      ) : null}

      <section className="card" aria-labelledby="service-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bước 1</p>
            <h2 id="service-title">Chọn dịch vụ</h2>
          </div>
          {loadingAction === 'services' ? <span role="status">Đang tải...</span> : null}
        </div>

        {services.length === 0 && loadingAction !== 'services' ? (
          <p className="empty-text">Chưa có dịch vụ để hiển thị.</p>
        ) : null}

        <div className="service-list" role="radiogroup" aria-label="Danh sách dịch vụ">
          {services.map((service) => (
            <label
              className={`service-option ${selectedServiceId === service.id ? 'selected' : ''}`}
              key={service.id}
            >
              <input
                type="radio"
                name="service"
                value={service.id}
                checked={selectedServiceId === service.id}
                disabled={busy || ticket !== null}
                onChange={() => setSelectedServiceId(service.id)}
              />
              <span className="service-code">{service.code}</span>
              <span>{service.name}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={busy || selectedServiceId === '' || ticket !== null}
          onClick={() => void handleCreateTicket()}
        >
          {loadingAction === 'create' ? 'Đang lấy số...' : 'Lấy số thứ tự'}
        </button>
        {selectedServiceId === '' && ticket === null ? (
          <p className="hint">Vui lòng chọn dịch vụ trước khi lấy số.</p>
        ) : null}
      </section>

      {ticket === null ? (
        <section className="ticket-card empty" aria-labelledby="ticket-empty-title">
          <h2 id="ticket-empty-title">Chưa có lượt đang chờ</h2>
          <p>Số thứ tự sẽ hiển thị tại đây sau khi bạn chọn dịch vụ và bấm lấy số.</p>
        </section>
      ) : (
        <section className="ticket-card" aria-labelledby="ticket-title">
          <p className="eyebrow">Số thứ tự của bạn</p>
          <h2 id="ticket-title">{ticket.ticketNumber}</h2>
          <dl>
            <div>
              <dt>Dịch vụ</dt>
              <dd>{selectedService?.name ?? ticket.serviceName}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{statusLabel(ticket.status)}</dd>
            </div>
            <div>
              <dt>Số người chờ phía trước</dt>
              <dd>{ticket.waitingAhead}</dd>
            </div>
          </dl>
          <div className="action-row">
            <button type="button" onClick={() => void handleRefreshStatus()} disabled={busy}>
              {loadingAction === 'status' ? 'Đang cập nhật...' : 'Cập nhật trạng thái'}
            </button>
            <button type="button" className="secondary-button" onClick={resetCurrentTicket} disabled={busy}>
              Lấy số khác
            </button>
          </div>
        </section>
      )}

      <footer>
        Giai đoạn này chỉ dùng mock API và không thu thập thông tin cá nhân nhạy cảm.
      </footer>
    </main>
  );
}
