import {
  isDisplayUpdateEvent,
  isQueueCallEvent,
  isQueueFinishEvent,
  isQueueRecallEvent,
  isQueueTransferEvent,
  type DisplayUpdateEvent,
  type QueueCallEvent,
  type QueueFinishEvent,
  type QueueRecallEvent,
  type QueueTransferEvent,
} from '@qms/contracts';
import { useEffect, useState } from 'react';

import './styles.css';

export const APP_NAME = 'Display_Central';

const DEMO_LOCATION_ID = 'location-demo-001';
const MAX_RECENT_CALLS = 6;
const COUNTER_NAMES: Readonly<Record<string, string>> = {
  'counter-demo-001': 'Quầy Demo 01',
  'counter-demo-002': 'Quầy Demo 02',
};

interface DisplayCall {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly counterName: string;
  readonly status: string;
  readonly timestamp: string;
}

function counterName(counterId: string | undefined): string {
  if (counterId === undefined) {
    return 'Chưa xác định quầy';
  }
  return COUNTER_NAMES[counterId] ?? `Quầy ${counterId}`;
}

function eventTimestamp(): string {
  return new Date().toISOString();
}

function createQueueCallEvent(): QueueCallEvent {
  return {
    eventId: `display-demo-call-${String(Date.now())}`,
    eventType: 'QUEUE_CALL',
    locationId: DEMO_LOCATION_ID,
    timestamp: eventTimestamp(),
    payload: {
      ticketId: 'ticket-display-demo-101',
      ticketNumber: 'A-101',
      counterId: 'counter-demo-001',
      counterName: COUNTER_NAMES['counter-demo-001'] ?? 'Quầy Demo 01',
    },
  };
}

function createQueueRecallEvent(): QueueRecallEvent {
  return {
    ...createQueueCallEvent(),
    eventId: `display-demo-recall-${String(Date.now())}`,
    eventType: 'QUEUE_RECALL',
  };
}

function createQueueTransferEvent(): QueueTransferEvent {
  return {
    eventId: `display-demo-transfer-${String(Date.now())}`,
    eventType: 'QUEUE_TRANSFER',
    locationId: DEMO_LOCATION_ID,
    timestamp: eventTimestamp(),
    payload: {
      ticketId: 'ticket-display-demo-202',
      ticketNumber: 'B-202',
      fromCounterId: 'counter-demo-001',
      toCounterId: 'counter-demo-002',
    },
  };
}

function createQueueFinishEvent(): QueueFinishEvent {
  return {
    eventId: `display-demo-finish-${String(Date.now())}`,
    eventType: 'QUEUE_FINISH',
    locationId: DEMO_LOCATION_ID,
    timestamp: eventTimestamp(),
    payload: {
      ticketId: 'ticket-display-demo-101',
      ticketNumber: 'A-101',
      counterId: 'counter-demo-001',
    },
  };
}

function createDisplayUpdateEvent(): DisplayUpdateEvent {
  const timestamp = eventTimestamp();
  return {
    eventId: `display-demo-update-${String(Date.now())}`,
    eventType: 'DISPLAY_UPDATE',
    locationId: DEMO_LOCATION_ID,
    timestamp,
    payload: {
      state: {
        locationId: DEMO_LOCATION_ID,
        counterId: 'counter-demo-002',
        currentTicket: {
          id: 'ticket-display-demo-303',
          locationId: DEMO_LOCATION_ID,
          ticketNumber: 'C-303',
          serviceId: 'service-demo-003',
          counterId: 'counter-demo-002',
          status: 'CALLED',
          source: 'KIOSK',
          priorityLevel: 0,
          issuedAt: timestamp,
          calledAt: timestamp,
        },
        waitingTickets: [],
        updatedAt: timestamp,
      },
    },
  };
}

function createInvalidPiiEvent(): unknown {
  return {
    ...createQueueCallEvent(),
    payload: {
      ticketId: 'ticket-invalid-pii',
      ticketNumber: 'PII-001',
      counterId: 'counter-demo-001',
      counterName: 'Quầy Demo 01',
      customerName: 'Dữ liệu không được hiển thị',
      cccd: 'Dữ liệu bị từ chối',
    },
  };
}

export function App() {
  const [currentCall, setCurrentCall] = useState<DisplayCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<readonly DisplayCall[]>([]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  function remember(call: DisplayCall): void {
    setRecentCalls((previous) =>
      [call, ...previous.filter((item) => item.ticketId !== call.ticketId)].slice(
        0,
        MAX_RECENT_CALLS,
      ),
    );
  }

  function injectEvent(value: unknown): void {
    let call: DisplayCall | null = null;

    if (isQueueCallEvent(value)) {
      call = {
        ...value.payload,
        status: 'ĐANG GỌI',
        timestamp: value.timestamp,
      };
    } else if (isQueueRecallEvent(value)) {
      call = {
        ...value.payload,
        status: 'GỌI LẠI',
        timestamp: value.timestamp,
      };
    } else if (isQueueTransferEvent(value)) {
      call = {
        ticketId: value.payload.ticketId,
        ticketNumber: value.payload.ticketNumber,
        counterName: counterName(value.payload.toCounterId),
        status: 'CHUYỂN QUẦY',
        timestamp: value.timestamp,
      };
    } else if (isQueueFinishEvent(value)) {
      const finished: DisplayCall = {
        ticketId: value.payload.ticketId,
        ticketNumber: value.payload.ticketNumber,
        counterName: counterName(value.payload.counterId),
        status: 'HOÀN THÀNH',
        timestamp: value.timestamp,
      };
      setCurrentCall((current) => (current?.ticketId === value.payload.ticketId ? null : current));
      remember(finished);
      setValidationMessage(null);
      return;
    } else if (isDisplayUpdateEvent(value)) {
      const ticket = value.payload.state.currentTicket;
      if (ticket === null) {
        setCurrentCall(null);
        setValidationMessage(null);
        return;
      }
      call = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        counterName: counterName(ticket.counterId ?? value.payload.state.counterId),
        status: ticket.status,
        timestamp: value.timestamp,
      };
    } else {
      setValidationMessage('Event không hợp lệ đã bị từ chối.');
      return;
    }

    setCurrentCall(call);
    remember(call);
    setValidationMessage(null);
  }

  return (
    <main className="display-page">
      <header className="display-header">
        <div>
          <p className="eyebrow">Hệ thống xếp hàng</p>
          <h1>Khu vực chờ trung tâm</h1>
        </div>
        <time dateTime={currentTime.toISOString()}>{currentTime.toLocaleTimeString('vi-VN')}</time>
      </header>

      <section className="current-call" aria-label="Số đang gọi">
        {currentCall === null ? (
          <div className="empty-state">
            <p>Chưa có số đang gọi</p>
            <span>Vui lòng theo dõi màn hình</span>
          </div>
        ) : (
          <>
            <p className="call-label">Số đang gọi</p>
            <strong className="ticket-number">{currentCall.ticketNumber}</strong>
            <h2>{currentCall.counterName}</h2>
            <span className="status-badge">{currentCall.status}</span>
          </>
        )}
      </section>

      <section className="recent-panel">
        <h2>Số gọi gần đây</h2>
        {recentCalls.length === 0 ? (
          <p className="recent-empty">Chưa có lịch sử gọi số.</p>
        ) : (
          <ol className="recent-list">
            {recentCalls.map((call) => (
              <li key={`${call.ticketId}-${call.status}`}>
                <strong>{call.ticketNumber}</strong>
                <span>{call.counterName}</span>
                <small>{call.status}</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="demo-panel" aria-label="Điều khiển demo development">
        <div>
          <strong>Demo development</strong>
          <span>Inject event cục bộ, không kết nối MQTT.</span>
        </div>
        <div className="demo-actions">
          <button type="button" onClick={() => injectEvent(createQueueCallEvent())}>
            Queue Call
          </button>
          <button type="button" onClick={() => injectEvent(createQueueRecallEvent())}>
            Queue Recall
          </button>
          <button type="button" onClick={() => injectEvent(createQueueTransferEvent())}>
            Queue Transfer
          </button>
          <button type="button" onClick={() => injectEvent(createQueueFinishEvent())}>
            Queue Finish
          </button>
          <button type="button" onClick={() => injectEvent(createDisplayUpdateEvent())}>
            Display Update
          </button>
          <button
            type="button"
            className="reject-button"
            onClick={() => injectEvent(createInvalidPiiEvent())}
          >
            Thử event PII sai
          </button>
        </div>
        {validationMessage !== null && <p role="alert">{validationMessage}</p>}
      </aside>
    </main>
  );
}
