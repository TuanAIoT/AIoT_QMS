import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { type BookingApi, createCentralApiClient, getCentralAppConfig } from './central-api';
import { getRuntimeConfig, initializeZaloRuntime, type ZaloRuntimeState } from './runtime';
import { useBookingFlow } from './use-booking-flow';
import './styles.css';

export const APP_NAME = 'Xếp hàng dịch vụ công';

const STATUS_LABELS = {
  CREATED: 'Đã tạo',
  CONFIRMED: 'Đã xác nhận',
  READY_FOR_CHECK_IN: 'Sẵn sàng check-in',
  CHECKED_IN: 'Đã check-in',
  QUEUED: 'Đang trong hàng chờ',
  CALLED: 'Đang được gọi',
  SERVING: 'Đang phục vụ',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
} as const;

export interface AppProps {
  readonly initializeRuntime?: () => Promise<ZaloRuntimeState>;
  readonly bookingApi?: BookingApi;
  readonly mockMode?: boolean;
  readonly pollIntervalMs?: number;
  readonly createIdempotencyKey?: () => string;
  readonly now?: () => Date;
  readonly confirmCancel?: () => boolean;
}

interface ApiSetup {
  readonly api: BookingApi | null;
  readonly isMockMode: boolean;
  readonly error: string | null;
}

function RuntimeStatus({ state }: { readonly state: ZaloRuntimeState }) {
  if (state.phase === 'initializing') {
    return <p role="status">Đang khởi tạo ứng dụng...</p>;
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Chưa xác định'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}

export function App({
  initializeRuntime: initializeRuntimeOverride,
  bookingApi,
  mockMode,
  pollIntervalMs,
  createIdempotencyKey,
  now,
  confirmCancel,
}: AppProps = {}) {
  const [runtimeState, setRuntimeState] = useState<ZaloRuntimeState>({ phase: 'initializing' });
  const [apiSetup] = useState<ApiSetup>(() => {
    if (bookingApi !== undefined) {
      return { api: bookingApi, isMockMode: mockMode ?? true, error: null };
    }
    try {
      const config = getCentralAppConfig();
      return {
        api: createCentralApiClient(config),
        isMockMode: config.isMockMode,
        error: null,
      };
    } catch (error) {
      return {
        api: null,
        isMockMode: false,
        error: error instanceof Error ? error.message : 'Cấu hình Central chưa hợp lệ.',
      };
    }
  });

  useEffect(() => {
    let active = true;
    const initialize =
      initializeRuntimeOverride ?? (() => initializeZaloRuntime(getRuntimeConfig()));
    void initialize()
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
  }, [initializeRuntimeOverride]);

  const runtimeReady = runtimeState.phase === 'ready';
  const flow = useBookingFlow({
    api: apiSetup.api,
    enabled: runtimeReady && apiSetup.error === null,
    ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
    ...(createIdempotencyKey === undefined ? {} : { createKey: createIdempotencyKey }),
    ...(now === undefined ? {} : { now }),
    ...(confirmCancel === undefined ? {} : { confirmCancel }),
  });
  const selectedLocation = flow.locations.find(
    (location) => location.locationId === flow.selectedLocationId,
  );
  const selectedService = flow.services.find(
    (service) => service.serviceId === flow.selectedServiceId,
  );
  const formDisabled = flow.busyAction !== null || flow.booking !== null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <span className="app-mark" aria-hidden="true">
          Q
        </span>
        <div className="app-title">
          <p className="app-kicker">Dịch vụ hành chính</p>
          <h1>{APP_NAME}</h1>
        </div>
        {apiSetup.isMockMode ? <span className="demo-badge">Chế độ thử nghiệm</span> : null}
      </header>

      <section className="runtime-card" aria-label="Trạng thái môi trường">
        <RuntimeStatus state={runtimeState} />
      </section>

      <section className="welcome-card">
        <p className="eyebrow">Đặt lượt trực tuyến</p>
        <h2>Chủ động thời gian, giảm thời gian chờ</h2>
        <p>Chọn điểm phục vụ và dịch vụ để tạo lượt thử nghiệm.</p>
      </section>

      {apiSetup.error !== null && runtimeReady ? (
        <section className="error-card" role="alert">
          <strong>Không thể khởi tạo Central</strong>
          <p>{apiSetup.error}</p>
        </section>
      ) : null}

      {flow.error !== null ? (
        <section className="error-card" role="alert">
          <strong>Yêu cầu chưa hoàn tất</strong>
          <p>{flow.error.message}</p>
          <button type="button" onClick={flow.retry} disabled={flow.busyAction !== null}>
            Thử lại
          </button>
        </section>
      ) : null}

      <section className="form-card" aria-labelledby="queue-form-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Lấy số trực tuyến</p>
            <h2 id="queue-form-title">Thông tin lượt chờ</h2>
          </div>
          <span className="pending-badge">
            {flow.phase === 'ready' ? 'Sẵn sàng' : 'Đang kết nối'}
          </span>
        </div>

        <label htmlFor="location">Điểm phục vụ</label>
        <select
          id="location"
          value={flow.selectedLocationId}
          disabled={flow.phase !== 'ready' || formDisabled}
          onChange={(event) => flow.selectLocation(event.target.value)}
        >
          <option value="">Chọn điểm phục vụ</option>
          {flow.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.displayName}
            </option>
          ))}
        </select>

        <label htmlFor="service">Dịch vụ</label>
        <select
          id="service"
          value={flow.selectedServiceId}
          disabled={
            flow.phase !== 'ready' ||
            flow.selectedLocationId.length === 0 ||
            flow.busyAction === 'services' ||
            formDisabled
          }
          onChange={(event) => flow.selectService(event.target.value)}
        >
          <option value="">
            {flow.busyAction === 'services' ? 'Đang tải dịch vụ...' : 'Chọn dịch vụ'}
          </option>
          {flow.services.map((service) => (
            <option key={service.serviceId} value={service.serviceId}>
              {service.displayName}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={
            flow.phase !== 'ready' ||
            flow.selectedServiceId.length === 0 ||
            flow.busyAction !== null ||
            flow.booking !== null
          }
          onClick={() => void flow.createBooking()}
        >
          {flow.busyAction === 'create' ? 'Đang tạo lượt...' : 'Lấy số thứ tự'}
        </button>
      </section>

      {flow.phase === 'initializing' ? (
        <section className="empty-card" role="status">
          <div className="loading-dot" aria-hidden="true" />
          <div>
            <h2>Đang kết nối Mock Central</h2>
            <p>Ứng dụng đang xác thực và tải danh sách địa điểm.</p>
          </div>
        </section>
      ) : null}

      {flow.phase === 'ready' && flow.booking === null ? (
        <section className="empty-card" aria-labelledby="current-ticket-title">
          <div className="empty-icon" aria-hidden="true">
            0
          </div>
          <div>
            <h2 id="current-ticket-title">Chưa có lượt đang chờ</h2>
            <p>Chọn địa điểm và dịch vụ để tạo lượt thử nghiệm.</p>
          </div>
        </section>
      ) : null}

      {flow.booking !== null ? (
        <section className="booking-card" aria-labelledby="booking-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Lượt hiện tại</p>
              <h2 id="booking-title">{flow.booking.bookingReference}</h2>
            </div>
            <span className={`status-chip status-${flow.booking.status.toLowerCase()}`}>
              {STATUS_LABELS[flow.booking.status]}
            </span>
          </div>
          <dl>
            <div>
              <dt>Địa điểm</dt>
              <dd>{selectedLocation?.displayName ?? flow.booking.locationId}</dd>
            </div>
            <div>
              <dt>Dịch vụ</dt>
              <dd>{selectedService?.displayName ?? flow.booking.serviceId}</dd>
            </div>
            <div>
              <dt>Thời gian</dt>
              <dd>{formatDateTime(flow.booking.requestedStartAt)}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{STATUS_LABELS[flow.booking.status]}</dd>
            </div>
          </dl>
          <div className="booking-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={flow.busyAction !== null || flow.isTerminal}
              onClick={() => void flow.createQr()}
            >
              {flow.busyAction === 'qr' ? 'Đang tạo QR...' : 'Tạo mã QR check-in'}
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={flow.busyAction !== null || !flow.booking.canCancel || flow.isTerminal}
              onClick={() => void flow.cancelBooking()}
            >
              {flow.busyAction === 'cancel' ? 'Đang hủy...' : 'Hủy lượt'}
            </button>
          </div>
        </section>
      ) : null}

      {flow.checkInToken !== null ? (
        <section className="qr-card" aria-labelledby="qr-title">
          <p className="eyebrow">Check-in tại điểm phục vụ</p>
          <h2 id="qr-title">Mã QR của lượt</h2>
          <div className="qr-frame" aria-label="Mã QR check-in">
            <QRCodeSVG value={flow.checkInToken.checkInToken} size={184} level="M" />
          </div>
          <p>Đưa mã này cho thiết bị check-in. Không chia sẻ ảnh mã QR.</p>
          <small>Hết hạn: {formatDateTime(flow.checkInToken.expiresAt)}</small>
        </section>
      ) : null}

      <footer>Chế độ thử nghiệm không yêu cầu thông tin cá nhân hoặc quyền truy cập Zalo.</footer>
    </main>
  );
}
