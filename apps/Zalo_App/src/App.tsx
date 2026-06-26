import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createQmsApiClient,
  QmsApiError,
  type QmsBookingApiClient,
  type QmsCounter,
  type QmsLocation,
  type QmsQueueStatus,
  type QmsService,
  type QmsTicket,
  type QmsTicketStatus,
} from './qms-api';
import { getRuntimeConfig, initializeZaloRuntime, type ZaloRuntimeState } from './runtime';
import './styles.css';

export const APP_NAME = 'Tuan QMS';
export const APP_SUBTITLE = 'Ứng dụng đặt số online';
export const DEMO_UNIT_NAME = 'AIoT Making Innovation';
export const DEMO_ORGANIZATION_NAME = 'Công ty TNHH Công nghệ AIoT';

type Screen =
  | 'home'
  | 'booking-location'
  | 'booking-service'
  | 'booking-detail'
  | 'booked-list'
  | 'queue-location'
  | 'queue-status'
  | 'public-service'
  | 'case-lookup';

type LoadingAction =
  | 'bootstrap'
  | 'locations'
  | 'services'
  | 'bookings'
  | 'queue'
  | 'create'
  | 'cancel'
  | 'detail'
  | null;

type RetryTarget = Exclude<LoadingAction, null>;

interface UiError {
  readonly code:
    | 'CONFIGURATION_ERROR'
    | 'REQUEST_ABORTED'
    | 'AUTH_FAILED'
    | 'SCHEMA_ERROR'
    | 'NETWORK_ERROR';
  readonly message: string;
  readonly retryTarget: RetryTarget;
}

interface CaseLookupResult {
  readonly caseCode: string;
  readonly status: 'Đang xử lý';
  readonly receivedAt: string;
  readonly note: 'Dữ liệu mô phỏng';
}

interface AppProps {
  readonly apiClient?: QmsBookingApiClient;
  readonly initializeRuntime?: () => Promise<ZaloRuntimeState>;
}

interface HomeMenuItem {
  readonly title: string;
  readonly subtitle: string;
  readonly screen: Screen;
}

const HOME_MENU_ITEMS: readonly HomeMenuItem[] = [
  {
    title: 'Đặt số trực tuyến',
    subtitle: 'Chọn địa điểm và dịch vụ',
    screen: 'booking-location',
  },
  { title: 'Số đã đặt', subtitle: 'Xem các lượt đã tạo', screen: 'booked-list' },
  {
    title: 'Tình hình số thứ tự',
    subtitle: 'Theo dõi tình trạng phục vụ',
    screen: 'queue-location',
  },
  {
    title: 'Cổng dịch vụ công quốc gia',
    subtitle: 'Chức năng sẽ tích hợp sau',
    screen: 'public-service',
  },
  { title: 'Tra cứu hồ sơ', subtitle: 'Mã hồ sơ mô phỏng', screen: 'case-lookup' },
];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Chưa xác định'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date);
}

function statusLabel(status: QmsTicketStatus): string {
  switch (status) {
    case 'WAITING':
      return 'Đang chờ';
    case 'CALLED':
      return 'Đã gọi';
    case 'SERVING':
      return 'Đang phục vụ';
    case 'COMPLETED':
      return 'Đã hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'EXPIRED':
      return 'Đã hết hạn';
  }
}

function counterStatusLabel(counter: QmsCounter): string {
  return counter.status === 'OPEN' ? 'Mở' : 'Đóng';
}

function mapApiError(error: unknown, retryTarget: RetryTarget): UiError {
  if (error instanceof QmsApiError) {
    if (error.kind === 'CONFIGURATION_ERROR') {
      return {
        code: 'CONFIGURATION_ERROR',
        message: error.message,
        retryTarget,
      };
    }
    if (error.kind === 'REQUEST_ABORTED') {
      return {
        code: 'REQUEST_ABORTED',
        message: error.message,
        retryTarget,
      };
    }
    if (error.kind === 'HTTP_ERROR' && error.status === 401) {
      return {
        code: 'AUTH_FAILED',
        message: error.message,
        retryTarget,
      };
    }
    if (error.kind === 'INVALID_RESPONSE') {
      return {
        code: 'SCHEMA_ERROR',
        message: 'Dữ liệu từ máy chủ thử nghiệm không đúng định dạng.',
        retryTarget,
      };
    }
    return {
      code: 'NETWORK_ERROR',
      message: error.message,
      retryTarget,
    };
  }
  return {
    code: 'NETWORK_ERROR',
    message: 'Không kết nối được máy chủ thử nghiệm.',
    retryTarget,
  };
}

function createCaseLookupResult(caseCode: string): CaseLookupResult {
  return {
    caseCode,
    status: 'Đang xử lý',
    receivedAt: new Date().toISOString(),
    note: 'Dữ liệu mô phỏng',
  };
}

function AppShell({ children }: { readonly children: React.ReactNode }) {
  return <main className="app-shell">{children}</main>;
}

function RuntimeStrip({ runtimeState }: { readonly runtimeState: ZaloRuntimeState }) {
  const label =
    runtimeState.phase === 'initializing'
      ? 'Đang khởi tạo Zalo Mini App...'
      : runtimeState.phase === 'configuration-error'
        ? 'Cấu hình Zalo Mini App chưa đầy đủ.'
        : runtimeState.phase === 'unsupported'
          ? 'Môi trường hiện tại chưa được hỗ trợ.'
          : runtimeState.runtime === 'zalo-mini-app'
            ? 'Đang chạy trong Zalo Mini App.'
            : 'Chế độ phát triển trên trình duyệt.';

  return (
    <section className="runtime-strip" aria-label="Trạng thái runtime">
      <span>{label}</span>
    </section>
  );
}

function ErrorBanner({
  error,
  onRetry,
}: {
  readonly error: UiError;
  readonly onRetry: () => void;
}) {
  return (
    <section className="error-banner" role="alert">
      <strong>
        {error.code === 'CONFIGURATION_ERROR'
          ? 'Cấu hình chưa đầy đủ'
          : error.code === 'REQUEST_ABORTED'
            ? 'Yêu cầu đã bị hủy'
            : error.code === 'AUTH_FAILED'
              ? 'Xác thực không thành công'
              : error.code === 'SCHEMA_ERROR'
                ? 'Dữ liệu từ máy chủ thử nghiệm không hợp lệ'
              : 'Không kết nối được máy chủ thử nghiệm'}
      </strong>
      <p>{error.message}</p>
      <button type="button" onClick={onRetry}>
        Thử lại
      </button>
    </section>
  );
}

function LoadingState({ label }: { readonly label: string }) {
  return (
    <section className="loading-card" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </section>
  );
}

function InfoCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
}) {
  return (
    <article className="info-card">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button type="button" className="secondary-button" onClick={onAction}>
        {actionLabel}
      </button>
    </article>
  );
}

function SectionHeading({
  kicker,
  title,
}: {
  readonly kicker: string;
  readonly title: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function ScreenHeader({
  title,
  heroTitle,
  description,
  onBack,
}: {
  readonly title: string;
  readonly heroTitle: string;
  readonly description: string;
  readonly onBack: () => void;
}) {
  return (
    <header className="screen-header">
      <button type="button" className="back-button" onClick={onBack} aria-label="Quay lại">
        ←
      </button>
      <div className="screen-header-copy">
        <p className="screen-title">{title}</p>
        <h1>{heroTitle}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function HomeScreen({
  onNavigate,
  onInterest,
  notice,
}: {
  readonly onNavigate: (screen: Screen) => void;
  readonly onInterest: () => void;
  readonly notice: string | null;
}) {
  return (
    <section className="home-screen">
      <header className="hero-banner">
        <div>
          <p className="hero-kicker">Tuan QMS</p>
          <h1>{APP_NAME}</h1>
          <p className="hero-subtitle">{APP_SUBTITLE}</p>
        </div>
        <span className="brand-chip">{DEMO_UNIT_NAME}</span>
      </header>

      <section className="menu-grid" aria-label="Menu chức năng">
        {HOME_MENU_ITEMS.map((item) => (
          <button
            key={item.title}
            type="button"
            className="menu-card"
            onClick={() => onNavigate(item.screen)}
          >
            <span className="menu-card-icon" aria-hidden="true">
              {item.screen === 'booking-location'
                ? '📅'
                : item.screen === 'booked-list'
                  ? '📘'
                  : item.screen === 'queue-location'
                    ? '🌐'
                    : item.screen === 'public-service'
                      ? '🌐'
                      : '🔎'}
            </span>
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
          </button>
        ))}
      </section>

      <section className="section-block">
        <SectionHeading kicker="Danh bạ" title="OA chính thức của đơn vị" />
        <InfoCard
          title={DEMO_UNIT_NAME}
          description="Chưa kết nối OA thật trong giai đoạn mock."
          actionLabel="Quan Tâm"
          onAction={onInterest}
        />
        {notice !== null ? <p className="notice-line">{notice}</p> : null}
      </section>

      <section className="section-block">
        <SectionHeading kicker="Liên hệ" title="Thông tin đơn vị" />
        <article className="contact-card">
          <strong>{DEMO_ORGANIZATION_NAME}</strong>
          <p>Ứng dụng đặt số online local-first cho dịch vụ công và chăm sóc công dân.</p>
        </article>
      </section>
    </section>
  );
}

function LocationSelectScreen({
  title,
  heroTitle,
  description,
  locations,
  loading,
  error,
  onBack,
  onRetry,
  onSelect,
}: {
  readonly title: string;
  readonly heroTitle: string;
  readonly description: string;
  readonly locations: readonly QmsLocation[];
  readonly loading: boolean;
  readonly error: UiError | null;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onSelect: (locationId: string) => void;
}) {
  return (
    <section className="flow-screen">
      <ScreenHeader title={title} heroTitle={heroTitle} description={description} onBack={onBack} />
      {error !== null ? <ErrorBanner error={error} onRetry={onRetry} /> : null}
      {loading ? <LoadingState label="Đang tải danh sách địa điểm..." /> : null}
      {!loading && locations.length === 0 ? (
        <section className="empty-card">
          <h2>Chưa có địa điểm</h2>
          <p>Hệ thống thử nghiệm chưa trả về dữ liệu để hiển thị.</p>
        </section>
      ) : null}
      <div className="location-list">
        {locations.map((location) => (
          <button
            key={location.locationId}
            type="button"
            className="location-card"
            onClick={() => onSelect(location.locationId)}
          >
            <span className="location-icon" aria-hidden="true">
              🏛
            </span>
            <span className="location-copy">
              <strong>{location.locationName}</strong>
              <span>{location.address ?? 'Chưa có địa chỉ'}</span>
            </span>
            <span className="location-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ServiceSelectScreen({
  title,
  heroTitle,
  description,
  location,
  services,
  loading,
  error,
  selectedServiceId,
  onBack,
  onRetry,
  onSelect,
  onSubmit,
}: {
  readonly title: string;
  readonly heroTitle: string;
  readonly description: string;
  readonly location: QmsLocation | null;
  readonly services: readonly QmsService[];
  readonly loading: boolean;
  readonly error: UiError | null;
  readonly selectedServiceId: string;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onSelect: (serviceId: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="flow-screen">
      <ScreenHeader title={title} heroTitle={heroTitle} description={description} onBack={onBack} />
      <div className="context-card">
        <strong>{location?.locationName ?? 'Chưa chọn địa điểm'}</strong>
        <span>{location?.address ?? 'Chưa có địa chỉ'}</span>
      </div>
      {error !== null ? <ErrorBanner error={error} onRetry={onRetry} /> : null}
      {loading ? <LoadingState label="Đang tải danh sách dịch vụ..." /> : null}
      {!loading && services.length === 0 ? (
        <section className="empty-card">
          <h2>Chưa có dịch vụ</h2>
          <p>Địa điểm này chưa có dịch vụ nào được mock.</p>
        </section>
      ) : null}
      <div className="service-list">
        {services.map((service) => {
          const selected = selectedServiceId === service.serviceId;
          return (
            <button
              key={service.serviceId}
              type="button"
              className={`service-card ${selected ? 'selected' : ''}`}
              onClick={() => onSelect(service.serviceId)}
            >
              <span className="service-code">{service.serviceCode}</span>
              <span className="service-copy">
                <strong>{service.serviceName}</strong>
                <span>{service.description ?? 'Dịch vụ mô phỏng'}</span>
              </span>
              <span className="service-state">{selected ? 'Đã chọn' : 'Chọn'}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="primary-button"
        onClick={onSubmit}
        disabled={selectedServiceId.length === 0 || loading}
      >
        Lấy số thứ tự
      </button>
    </section>
  );
}

function BookingDetailScreen({
  booking,
  onBackHome,
  onCancel,
  onRefresh,
  cancelLoading,
  refreshLoading,
}: {
  readonly booking: QmsTicket;
  readonly onBackHome: () => void;
  readonly onCancel: () => void;
  readonly onRefresh: () => void;
  readonly cancelLoading: boolean;
  readonly refreshLoading: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(booking.qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 192,
    })
      .then((dataUrl) => {
        if (active) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl(null);
        }
      });
    return () => {
      active = false;
    };
  }, [booking.qrPayload]);

  return (
    <section className="flow-screen">
      <ScreenHeader
        title="Số đã đặt"
        heroTitle="Số đã đặt"
        description="Mã đặt lượt online đã được xác nhận"
        onBack={onBackHome}
      />
      <section className="status-pill confirmed">Đã xác nhận</section>
      <section className="qr-card">
        <div className="qr-frame" aria-label="Mã QR của booking">
          {qrDataUrl !== null ? <img src={qrDataUrl} alt="Mã QR của booking" /> : <span>Đang tạo QR...</span>}
        </div>
        <p>Mã QR chỉ chứa thông tin đặt lượt mô phỏng và không mang dữ liệu cá nhân.</p>
      </section>
      <section className="ticket-detail-card">
        <h2>#{booking.ticketNumber}</h2>
        <dl>
          <div>
            <dt>Ngày</dt>
            <dd>{formatDate(booking.createdAt)}</dd>
          </div>
          <div>
            <dt>Thời gian hiệu lực</dt>
            <dd>{formatDateTime(booking.createdAt)}</dd>
          </div>
          <div>
            <dt>Thời hạn check-in</dt>
            <dd>{formatDateTime(booking.checkInExpiresAt)}</dd>
          </div>
          <div>
            <dt>Khách hàng</dt>
            <dd>Khách hàng</dd>
          </div>
          <div>
            <dt>Địa điểm</dt>
            <dd>{booking.locationName}</dd>
          </div>
          <div>
            <dt>Dịch vụ</dt>
            <dd>{booking.serviceName}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>{statusLabel(booking.status)}</dd>
          </div>
        </dl>
        <div className="action-row">
          <button
            type="button"
            className="danger-button"
            onClick={onCancel}
            disabled={cancelLoading || !booking.canCancel}
          >
            {cancelLoading ? 'Đang hủy...' : 'Hủy Booking'}
          </button>
          <button type="button" className="secondary-button" onClick={onRefresh} disabled={refreshLoading}>
            {refreshLoading ? 'Đang làm mới...' : 'Làm mới'}
          </button>
        </div>
      </section>
    </section>
  );
}

function BookedTicketsScreen({
  loading,
  error,
  bookings,
  onBackHome,
  onRetry,
  onSelect,
}: {
  readonly loading: boolean;
  readonly error: UiError | null;
  readonly bookings: readonly QmsTicket[];
  readonly onBackHome: () => void;
  readonly onRetry: () => void;
  readonly onSelect: (booking: QmsTicket) => void;
}) {
  return (
    <section className="flow-screen">
      <ScreenHeader
        title="Số đã đặt"
        heroTitle="Số đã đặt"
        description="Danh sách các lượt đã tạo trong mock"
        onBack={onBackHome}
      />
      {error !== null ? <ErrorBanner error={error} onRetry={onRetry} /> : null}
      {loading ? <LoadingState label="Đang tải danh sách số đã đặt..." /> : null}
      {!loading && bookings.length === 0 ? (
        <section className="empty-card">
          <h2>Bạn chưa có số đã đặt</h2>
          <p>Hãy quay lại trang chủ để đặt số trực tuyến.</p>
        </section>
      ) : null}
      <div className="ticket-list">
        {bookings.map((booking) => (
          <button
            key={booking.ticketId}
            type="button"
            className="ticket-list-card"
            onClick={() => onSelect(booking)}
          >
            <div className="ticket-list-number">#{booking.ticketNumber}</div>
            <div className="ticket-list-copy">
              <strong>{booking.locationName}</strong>
              <span>{booking.serviceName}</span>
              <span>{statusLabel(booking.status)}</span>
            </div>
            <span className="ticket-list-time">{formatDateTime(booking.createdAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function QueueStatusScreen({
  title,
  heroTitle,
  description,
  location,
  queueStatus,
  loading,
  error,
  onBack,
  onRetry,
  onRefresh,
}: {
  readonly title: string;
  readonly heroTitle: string;
  readonly description: string;
  readonly location: QmsLocation | null;
  readonly queueStatus: QmsQueueStatus | null;
  readonly loading: boolean;
  readonly error: UiError | null;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onRefresh: () => void;
}) {
  return (
    <section className="flow-screen">
      <ScreenHeader title={title} heroTitle={heroTitle} description={description} onBack={onBack} />
      <div className="context-card">
        <strong>{location?.locationName ?? 'Chưa chọn địa điểm'}</strong>
        <span>{location?.address ?? 'Chưa có địa chỉ'}</span>
      </div>
      {error !== null ? <ErrorBanner error={error} onRetry={onRetry} /> : null}
      {loading ? <LoadingState label="Đang tải tình hình số thứ tự..." /> : null}
      {queueStatus !== null ? (
        <>
          <section className="status-card">
            <h2>Trạng thái hiện tại</h2>
            <p>Trạng thái đặt số: {queueStatus.bookingEnabled ? 'Đang hoạt động' : 'Tạm dừng'}</p>
            <p>Ngày: {formatDateTime(queueStatus.currentDate)}</p>
            <button type="button" className="secondary-button" onClick={onRefresh} disabled={loading}>
              Làm mới
            </button>
          </section>

          <section className="counter-block">
            <SectionHeading kicker="Quầy" title="Danh sách quầy" />
            {queueStatus.counters.length === 0 ? (
              <section className="empty-card">
                <h2>Chưa có quầy phục vụ</h2>
                <p>Địa điểm này chưa cấu hình quầy nào để hiển thị.</p>
              </section>
            ) : (
              <div className="counter-list">
                {queueStatus.counters.map((counter) => (
                  <article key={counter.counterId} className="counter-card">
                    <strong>{counter.counterName}</strong>
                    <span>{counterStatusLabel(counter)}</span>
                    <span>
                      Đang gọi: {counter.currentTicketNumber ?? 'Chưa có số'}
                    </span>
                    <span>
                      Dịch vụ: {counter.servingServiceName ?? 'Chưa phục vụ'}
                    </span>
                    <span>Cập nhật: {formatDateTime(counter.updatedAt)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="counter-block">
            <SectionHeading kicker="Đang chờ" title="Danh sách chờ" />
            {queueStatus.waitingTickets.length === 0 ? (
              <section className="empty-card">
                <h2>Chưa có vé chờ</h2>
                <p>Hiện chưa có lượt nào đang chờ tại địa điểm này.</p>
              </section>
            ) : (
              <div className="waiting-list">
                {queueStatus.waitingTickets.map((booking) => (
                  <article key={booking.ticketId} className="waiting-card">
                    <strong>#{booking.ticketNumber}</strong>
                    <span>{booking.serviceName}</span>
                    <span>{statusLabel(booking.status)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function PublicServicePlaceholderScreen({ onBack }: { readonly onBack: () => void }) {
  return (
    <section className="flow-screen">
      <ScreenHeader
        title="Cổng dịch vụ công quốc gia"
        heroTitle="Cổng dịch vụ công quốc gia"
        description="Chức năng sẽ được tích hợp sau"
        onBack={onBack}
      />
      <section className="placeholder-card">
        <h2>Cổng dịch vụ công quốc gia</h2>
        <p>Chức năng này sẽ được tích hợp sau.</p>
        <button type="button" onClick={onBack}>
          Về Trang Chủ
        </button>
      </section>
    </section>
  );
}

function CaseLookupScreen({
  caseCode,
  result,
  errorMessage,
  onBack,
  onCaseCodeChange,
  onSubmit,
}: {
  readonly caseCode: string;
  readonly result: CaseLookupResult | null;
  readonly errorMessage: string | null;
  readonly onBack: () => void;
  readonly onCaseCodeChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="flow-screen">
      <ScreenHeader
        title="Tra cứu hồ sơ"
        heroTitle="Tra cứu hồ sơ"
        description="Dữ liệu tra cứu ở giai đoạn này là mô phỏng"
        onBack={onBack}
      />
      <section className="lookup-card">
        <label htmlFor="case-code">Mã hồ sơ</label>
        <input
          id="case-code"
          value={caseCode}
          onChange={(event) => onCaseCodeChange(event.target.value)}
          placeholder="Nhập mã hồ sơ"
        />
        <button type="button" className="primary-button" onClick={onSubmit}>
          Tra cứu
        </button>
        {errorMessage !== null ? <p className="inline-error">{errorMessage}</p> : null}
      </section>
      {result !== null ? (
        <section className="lookup-result-card">
          <h2>Kết quả tra cứu</h2>
          <dl>
            <div>
              <dt>Mã hồ sơ</dt>
              <dd>{result.caseCode}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{result.status}</dd>
            </div>
            <div>
              <dt>Ngày tiếp nhận</dt>
              <dd>{formatDateTime(result.receivedAt)}</dd>
            </div>
            <div>
              <dt>Ghi chú</dt>
              <dd>{result.note}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </section>
  );
}

export function App({ apiClient, initializeRuntime }: AppProps = {}) {
  const api = useMemo(() => apiClient ?? createQmsApiClient(), [apiClient]);
  const [runtimeState, setRuntimeState] = useState<ZaloRuntimeState>({ phase: 'initializing' });
  const [screen, setScreen] = useState<Screen>('home');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>('bootstrap');
  const [error, setError] = useState<UiError | null>(null);
  const [homeNotice, setHomeNotice] = useState<string | null>(null);
  const [locations, setLocations] = useState<readonly QmsLocation[]>([]);
  const [services, setServices] = useState<readonly QmsService[]>([]);
  const [bookings, setBookings] = useState<readonly QmsTicket[]>([]);
  const [queueStatus, setQueueStatus] = useState<QmsQueueStatus | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<QmsTicket | null>(null);
  const [caseCode, setCaseCode] = useState('');
  const [caseResult, setCaseResult] = useState<CaseLookupResult | null>(null);
  const [caseErrorMessage, setCaseErrorMessage] = useState<string | null>(null);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.locationId === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );
  const selectedQueueLocation = useMemo(
    () => locations.find((location) => location.locationId === queueStatus?.locationId) ?? null,
    [locations, queueStatus?.locationId],
  );
  const serviceTargetLocation = selectedLocation;

  const loadLocations = useCallback(
    async (signal?: AbortSignal): Promise<readonly QmsLocation[]> => {
      setLoadingAction('locations');
      setError(null);
      try {
        const loaded = await api.getLocations(signal);
        setLocations(loaded);
        return loaded;
      } catch (caught) {
        if (signal?.aborted !== true) {
          setError(mapApiError(caught, 'locations'));
        }
        return [];
      } finally {
        if (signal?.aborted !== true) {
          setLoadingAction(null);
        }
      }
    },
    [api],
  );

  const loadServices = useCallback(
    async (locationId: string, signal?: AbortSignal): Promise<void> => {
      setLoadingAction('services');
      setError(null);
      setSelectedLocationId(locationId);
      setSelectedServiceId('');
      try {
        const loaded = await api.getServices(locationId, signal);
        setServices(loaded);
      } catch (caught) {
        if (signal?.aborted !== true) {
          setError(mapApiError(caught, 'services'));
        }
      } finally {
        if (signal?.aborted !== true) {
          setLoadingAction(null);
        }
      }
    },
    [api],
  );

  const loadBookings = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLoadingAction('bookings');
      setError(null);
      try {
        const loaded = await api.listTickets({}, signal);
        setBookings(loaded);
      } catch (caught) {
        if (signal?.aborted !== true) {
          setError(mapApiError(caught, 'bookings'));
        }
      } finally {
        if (signal?.aborted !== true) {
          setLoadingAction(null);
        }
      }
    },
    [api],
  );

  const loadQueueStatus = useCallback(
    async (locationId: string, signal?: AbortSignal): Promise<void> => {
      setLoadingAction('queue');
      setError(null);
      setSelectedLocationId(locationId);
      try {
        const loaded = await api.getQueueStatus(locationId, signal);
        setQueueStatus(loaded);
      } catch (caught) {
        if (signal?.aborted !== true) {
          setError(mapApiError(caught, 'queue'));
        }
      } finally {
        if (signal?.aborted !== true) {
          setLoadingAction(null);
        }
      }
    },
    [api],
  );

  const refreshSelectedBooking = useCallback(async (): Promise<void> => {
    if (selectedBooking === null) {
      return;
    }
    setLoadingAction('detail');
    setError(null);
    try {
      const refreshed = await api.getTicket(selectedBooking.ticketId);
      setSelectedBooking(refreshed);
      setBookings((current) =>
        current.map((booking) => (booking.ticketId === refreshed.ticketId ? refreshed : booking)),
      );
    } catch (caught) {
      setError(mapApiError(caught, 'detail'));
    } finally {
      setLoadingAction(null);
    }
  }, [api, selectedBooking]);

  const createBooking = useCallback(async (): Promise<void> => {
    if (selectedLocationId.length === 0 || selectedServiceId.length === 0) {
      return;
    }
    setLoadingAction('create');
    setError(null);
    try {
      const created = await api.createTicket({
        locationId: selectedLocationId,
        serviceId: selectedServiceId,
      });
      setSelectedBooking(created);
      setBookings((current) => [created, ...current.filter((booking) => booking.ticketId !== created.ticketId)]);
      setScreen('booking-detail');
      await loadQueueStatus(created.locationId);
    } catch (caught) {
      setError(mapApiError(caught, 'create'));
    } finally {
      setLoadingAction(null);
    }
  }, [api, loadQueueStatus, selectedLocationId, selectedServiceId]);

  const cancelBooking = useCallback(async (): Promise<void> => {
    if (selectedBooking === null) {
      return;
    }
    setLoadingAction('cancel');
    setError(null);
    try {
      const cancelled = await api.cancelTicket(selectedBooking.ticketId);
      setSelectedBooking(cancelled);
      setBookings((current) =>
        current.map((booking) => (booking.ticketId === cancelled.ticketId ? cancelled : booking)),
      );
      await loadQueueStatus(cancelled.locationId);
    } catch (caught) {
      setError(mapApiError(caught, 'cancel'));
    } finally {
      setLoadingAction(null);
    }
  }, [api, loadQueueStatus, selectedBooking]);

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
    void loadLocations(controller.signal);
    return () => controller.abort();
  }, [loadLocations]);

  const retry = useCallback((): void => {
    if (error === null) {
      return;
    }
    if (error.retryTarget === 'locations') {
      void loadLocations();
      return;
    }
    if (error.retryTarget === 'services' && selectedLocationId.length > 0) {
      void loadServices(selectedLocationId);
      return;
    }
    if (error.retryTarget === 'bookings') {
      void loadBookings();
      return;
    }
    if (error.retryTarget === 'queue' && selectedLocationId.length > 0) {
      void loadQueueStatus(selectedLocationId);
      return;
    }
    if (error.retryTarget === 'create') {
      void createBooking();
      return;
    }
    if (error.retryTarget === 'cancel') {
      void cancelBooking();
      return;
    }
    if (error.retryTarget === 'detail') {
      void refreshSelectedBooking();
    }
  }, [
    cancelBooking,
    createBooking,
    error,
    loadBookings,
    loadLocations,
    loadQueueStatus,
    loadServices,
    refreshSelectedBooking,
    selectedLocationId,
  ]);

  const navigateHome = useCallback(() => {
    setScreen('home');
    setError(null);
  }, []);

  const navigateBookingLocations = useCallback(() => {
    setScreen('booking-location');
    setError(null);
    if (locations.length === 0) {
      void loadLocations();
    }
  }, [loadLocations, locations.length]);

  const navigateBookedList = useCallback(() => {
    setScreen('booked-list');
    setError(null);
    void loadBookings();
  }, [loadBookings]);

  const navigateQueueLocations = useCallback(() => {
    setScreen('queue-location');
    setError(null);
    if (locations.length === 0) {
      void loadLocations();
    }
  }, [loadLocations, locations.length]);

  const navigatePublicService = useCallback(() => {
    setScreen('public-service');
    setError(null);
  }, []);

  const navigateCaseLookup = useCallback(() => {
    setScreen('case-lookup');
    setError(null);
  }, []);

  const selectBookingLocation = useCallback(
    (locationId: string) => {
      setScreen('booking-service');
      void loadServices(locationId);
    },
    [loadServices],
  );

  const selectQueueLocation = useCallback(
    (locationId: string) => {
      setScreen('queue-status');
      void loadQueueStatus(locationId);
    },
    [loadQueueStatus],
  );

  const selectBookedTicket = useCallback((booking: QmsTicket) => {
    setSelectedBooking(booking);
    setScreen('booking-detail');
  }, []);

  const submitCaseLookup = useCallback(() => {
    if (!hasText(caseCode)) {
      setCaseErrorMessage('Vui lòng nhập mã hồ sơ.');
      setCaseResult(null);
      return;
    }
    setCaseErrorMessage(null);
    setCaseResult(createCaseLookupResult(caseCode.trim()));
  }, [caseCode]);

  const openOAInterest = useCallback(() => {
    setHomeNotice('Chức năng theo dõi OA sẽ được nối sau khi backend sẵn sàng.');
  }, []);

  const queueButtonsDisabled = loadingAction !== null;

  return (
    <AppShell>
      <RuntimeStrip runtimeState={runtimeState} />
      {error !== null ? <ErrorBanner error={error} onRetry={retry} /> : null}

      {screen === 'home' ? (
        <HomeScreen
          onNavigate={(next) => {
            if (next === 'booking-location') {
              navigateBookingLocations();
              return;
            }
            if (next === 'booked-list') {
              navigateBookedList();
              return;
            }
            if (next === 'queue-location') {
              navigateQueueLocations();
              return;
            }
            if (next === 'public-service') {
              navigatePublicService();
              return;
            }
            if (next === 'case-lookup') {
              navigateCaseLookup();
            }
          }}
          onInterest={openOAInterest}
          notice={homeNotice}
        />
      ) : null}

      {screen === 'booking-location' ? (
        <LocationSelectScreen
          title="Đặt Số Trực Tuyến"
          heroTitle="Chọn địa điểm"
          description="Vui lòng chọn địa điểm bạn muốn đặt số để tiếp tục"
          locations={locations}
          loading={loadingAction === 'locations'}
          error={error}
          onBack={navigateHome}
          onRetry={retry}
          onSelect={selectBookingLocation}
        />
      ) : null}

      {screen === 'booking-service' ? (
        <ServiceSelectScreen
          title="Đặt Số Trực Tuyến"
          heroTitle="Chọn dịch vụ"
          description="Chọn dịch vụ rồi bấm lấy số thứ tự"
          location={serviceTargetLocation}
          services={services}
          loading={loadingAction === 'services'}
          error={error}
          selectedServiceId={selectedServiceId}
          onBack={navigateBookingLocations}
          onRetry={() => {
            if (selectedLocationId.length > 0) {
              void loadServices(selectedLocationId);
            }
          }}
          onSelect={(serviceId) => setSelectedServiceId(serviceId)}
          onSubmit={() => void createBooking()}
        />
      ) : null}

      {screen === 'booking-detail' && selectedBooking !== null ? (
        <BookingDetailScreen
          booking={selectedBooking}
          onBackHome={navigateHome}
          onCancel={() => void cancelBooking()}
          onRefresh={() => void refreshSelectedBooking()}
          cancelLoading={loadingAction === 'cancel'}
          refreshLoading={loadingAction === 'detail'}
        />
      ) : null}

      {screen === 'booked-list' ? (
        <BookedTicketsScreen
          loading={loadingAction === 'bookings'}
          error={error}
          bookings={bookings}
          onBackHome={navigateHome}
          onRetry={() => void loadBookings()}
          onSelect={selectBookedTicket}
        />
      ) : null}

      {screen === 'queue-location' ? (
        <LocationSelectScreen
          title="Tình Hình Số Thứ Tự"
          heroTitle="Chọn địa điểm"
          description="Vui lòng chọn địa điểm để xem tình hình số thứ tự"
          locations={locations}
          loading={loadingAction === 'locations'}
          error={error}
          onBack={navigateHome}
          onRetry={retry}
          onSelect={selectQueueLocation}
        />
      ) : null}

      {screen === 'queue-status' ? (
        <QueueStatusScreen
          title="Tình Hình Số Thứ Tự"
          heroTitle="Tình Hình Số Thứ Tự"
          description="Trạng thái phục vụ được mô phỏng từ mock server"
          location={selectedQueueLocation}
          queueStatus={queueStatus}
          loading={queueButtonsDisabled}
          error={error}
          onBack={navigateQueueLocations}
          onRetry={() => {
            if (selectedLocationId.length > 0) {
              void loadQueueStatus(selectedLocationId);
            }
          }}
          onRefresh={() => {
            if (selectedLocationId.length > 0) {
              void loadQueueStatus(selectedLocationId);
            }
          }}
        />
      ) : null}

      {screen === 'public-service' ? <PublicServicePlaceholderScreen onBack={navigateHome} /> : null}

      {screen === 'case-lookup' ? (
        <CaseLookupScreen
          caseCode={caseCode}
          result={caseResult}
          errorMessage={caseErrorMessage}
          onBack={navigateHome}
          onCaseCodeChange={(value) => {
            setCaseCode(value);
            setCaseErrorMessage(null);
          }}
          onSubmit={submitCaseLookup}
        />
      ) : null}

      {loadingAction === 'bootstrap' ? <LoadingState label="Đang tải danh mục thử nghiệm..." /> : null}
    </AppShell>
  );
}
