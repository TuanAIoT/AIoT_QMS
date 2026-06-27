import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createQmsApiClient,
  QmsApiError,
  type QmsAreaDto,
  type QmsBookingApiClient,
  type QmsLocationDto,
  type QmsQueueStatusDto,
  type QmsServiceDto,
  type QmsTicketDto,
} from './qms-api';
import { getRuntimeConfig, initializeZaloRuntime, type ZaloRuntimeState } from './runtime';
import './styles.css';

export const APP_NAME = 'AIoT JSC QMS';
export const APP_SUBTITLE = 'Ứng dụng đặt số và tra cứu hàng chờ';
export const ORGANIZATION_NAME = 'Công ty Cổ phần hệ thống AIoT';
export const ORGANIZATION_WEBSITE = 'https://aiots.vn';
export const ORGANIZATION_EMAIL = 'aiot@aiots.vn';
export const ORGANIZATION_HOTLINES = ['097 186 8316', '0839 799 889'] as const;
export const ORGANIZATION_ADDRESS = 'VPGD: Số A21-TT9 Đường Foresa 1 KĐT Xuân Phương, Phường Xuân Phương, Hà Nội.';

type Screen = 'home' | 'locations' | 'booking' | 'current-booking' | 'history' | 'queue';
type LoadingTarget = 'bootstrap' | 'locations' | 'areas' | 'services' | 'booking' | 'queue' | 'history' | 'booking-detail' | null;
type RetryTarget = Exclude<LoadingTarget, null>;

interface UiError {
  readonly code: 'CONFIGURATION_ERROR' | 'REQUEST_ABORTED' | 'AUTH_FAILED' | 'SCHEMA_ERROR' | 'NETWORK_ERROR';
  readonly message: string;
  readonly retryTarget: RetryTarget;
}

interface LocationModel {
  readonly id: string;
  readonly name: string;
  readonly address: string;
}

interface AreaModel {
  readonly id: string;
  readonly name: string;
}

interface ServiceModel {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly areaId: string;
  readonly description: string | null;
}

interface AppProps {
  readonly apiClient?: QmsBookingApiClient;
  readonly initializeRuntime?: () => Promise<ZaloRuntimeState>;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function toLocalDateValue(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function mapLocation(dto: QmsLocationDto): LocationModel {
  return { id: dto.locationId, name: dto.locationName, address: dto.address };
}

function mapArea(dto: QmsAreaDto): AreaModel {
  return { id: dto.areaId, name: dto.areaName };
}

function mapService(dto: QmsServiceDto): ServiceModel {
  return { id: dto.serviceId, name: dto.serviceName, code: dto.serviceCode, areaId: dto.areaId, description: dto.description };
}

function mapApiError(error: unknown, retryTarget: RetryTarget): UiError {
  if (error instanceof QmsApiError) {
    if (error.kind === 'CONFIGURATION_ERROR') {
      return { code: 'CONFIGURATION_ERROR', message: error.message, retryTarget };
    }
    if (error.kind === 'REQUEST_ABORTED') {
      return { code: 'REQUEST_ABORTED', message: error.message, retryTarget };
    }
    if (error.kind === 'HTTP_ERROR' && error.status === 401) {
      return { code: 'AUTH_FAILED', message: error.message, retryTarget };
    }
    if (error.kind === 'INVALID_RESPONSE') {
      return { code: 'SCHEMA_ERROR', message: 'Dữ liệu từ máy chủ thử nghiệm không đúng định dạng.', retryTarget };
    }
    return { code: 'NETWORK_ERROR', message: error.message, retryTarget };
  }
  return { code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ thử nghiệm.', retryTarget };
}

function HomeBanner({ onGoBooking, onGoHistory, onGoQueue }: { readonly onGoBooking: () => void; readonly onGoHistory: () => void; readonly onGoQueue: () => void; }) {
  return (
    <section className="home-screen">
      <header className="hero-banner">
        <div>
          <p className="hero-kicker">AIoT JSC QMS</p>
          <h1>{APP_NAME}</h1>
          <p className="hero-subtitle">{APP_SUBTITLE}</p>
        </div>
        <span className="brand-chip">Chế độ thử nghiệm</span>
      </header>
      <section className="menu-grid">
        <button type="button" className="menu-card" onClick={onGoBooking}><span aria-hidden="true">📅</span><strong>Đặt số trực tuyến</strong><span>Chọn đơn vị và lĩnh vực</span></button>
        <button type="button" className="menu-card" onClick={onGoHistory}><span aria-hidden="true">📘</span><strong>Số đã đặt</strong><span>Xem phiếu đang hoạt động</span></button>
        <button type="button" className="menu-card" onClick={onGoQueue}><span aria-hidden="true">🌐</span><strong>Tình hình số thứ tự</strong><span>Theo dõi quầy và số chờ</span></button>
      </section>
      <section className="section-block">
        <article className="contact-card">
          <strong>{ORGANIZATION_NAME}</strong>
          <p>
            <a href={ORGANIZATION_WEBSITE} target="_blank" rel="noreferrer">Website: {ORGANIZATION_WEBSITE}</a>
          </p>
          <p>
            <a href={`mailto:${ORGANIZATION_EMAIL}`}>Email: {ORGANIZATION_EMAIL}</a>
          </p>
          <p>
            Hotline/Zalo:{' '}
            {ORGANIZATION_HOTLINES.map((phone, index) => (
              <span key={phone}>
                {index > 0 ? ' | ' : ''}
                <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
              </span>
            ))}
          </p>
          <p>{ORGANIZATION_ADDRESS}</p>
        </article>
      </section>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { readonly title: string; readonly subtitle?: string }) {
  return (
    <div className="section-heading">
      <div>
        {subtitle === undefined ? null : <p className="section-kicker">{subtitle}</p>}
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { readonly error: UiError; readonly onRetry: () => void }) {
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
                ? 'Dữ liệu từ máy chủ thử nghiệm không đúng định dạng'
                : 'Không kết nối được máy chủ thử nghiệm'}
      </strong>
      <p>{error.message}</p>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </section>
  );
}

function LoadingState({ label }: { readonly label: string }) {
  return <section className="loading-card" role="status" aria-live="polite"><p>{label}</p></section>;
}

function LocationPicker({
  locations,
  onSelect,
}: {
  readonly locations: readonly LocationModel[];
  readonly onSelect: (location: LocationModel) => void;
}) {
  return (
    <section className="section-block">
      <SectionTitle title="Chọn đơn vị" />
      <div className="location-list">
        {locations.map((location) => (
          <button key={location.id} type="button" className="location-card" onClick={() => onSelect(location)}>
            <span className="location-copy">
              <strong>{location.name}</strong>
              <span>{location.address}</span>
            </span>
            <span className="location-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BookingScreen({
  location,
  areas,
  services,
  selectedAreaId,
  selectedServiceId,
  fullName,
  bookingDate,
  loadingArea,
  loadingService,
  submitting,
  areaError,
  serviceError,
  onBack,
  onSelectArea,
  onSelectService,
  onFullNameChange,
  onBookingDateChange,
  onSubmit,
  onRetry,
}: {
  readonly location: LocationModel;
  readonly areas: readonly AreaModel[];
  readonly services: readonly ServiceModel[];
  readonly selectedAreaId: string;
  readonly selectedServiceId: string;
  readonly fullName: string;
  readonly bookingDate: string;
  readonly loadingArea: boolean;
  readonly loadingService: boolean;
  readonly submitting: boolean;
  readonly areaError: UiError | null;
  readonly serviceError: UiError | null;
  readonly onBack: () => void;
  readonly onSelectArea: (areaId: string) => void;
  readonly onSelectService: (serviceId: string) => void;
  readonly onFullNameChange: (value: string) => void;
  readonly onBookingDateChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onRetry: () => void;
}) {
  const today = new Date();
  const dateChoices = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 1);
    return date;
  });

  return (
    <section className="flow-screen">
      <header className="screen-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="Quay lại">←</button>
        <div>
          <p className="screen-title">Đặt số trực tuyến</p>
          <h1>Chọn dịch vụ</h1>
          <p>{location.name}</p>
        </div>
      </header>

      <section className="context-card">
        <strong>{location.name}</strong>
        <span>{location.address}</span>
      </section>

      <section className="section-block">
        <SectionTitle title="Bảng lịch ngày" />
        <div className="date-strip">
          {dateChoices.map((date, index) => {
            const value = toLocalDateValue(date);
            const isPast = index === 0;
            const label = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);
            return (
              <button
                key={value}
                type="button"
                className={`date-chip ${bookingDate === value ? 'selected' : ''}`}
                disabled={isPast}
                onClick={() => onBookingDateChange(value)}
                aria-pressed={bookingDate === value}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section-block">
        <SectionTitle title="Lĩnh vực" />
        {loadingArea ? <LoadingState label="Đang tải lĩnh vực..." /> : null}
        {areaError === null ? null : <section className="inline-error" role="alert"><p>{areaError.message}</p><button type="button" onClick={onRetry}>Thử lại</button></section>}
        {!loadingArea && areaError === null && areas.length === 0 ? <p className="empty-inline">Chưa có lĩnh vực khả dụng.</p> : null}
        <div className="service-list">
          {areas.map((area) => (
            <button key={area.id} type="button" className={`service-card ${selectedAreaId === area.id ? 'selected' : ''}`} onClick={() => onSelectArea(area.id)}>
              <span className="service-copy"><strong>{area.name}</strong></span>
              <span>{selectedAreaId === area.id ? 'Đã chọn' : 'Chọn'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <SectionTitle title="Dịch vụ" />
        {loadingService ? <LoadingState label="Đang tải dịch vụ..." /> : null}
        {serviceError === null ? null : <section className="inline-error" role="alert"><p>{serviceError.message}</p><button type="button" onClick={onRetry}>Thử lại</button></section>}
        {!loadingService && serviceError === null && !hasText(selectedAreaId) ? <p className="empty-inline">Chọn lĩnh vực để tải dịch vụ.</p> : null}
        {!loadingService && serviceError === null && hasText(selectedAreaId) && services.length === 0 ? <p className="empty-inline">Chưa có dịch vụ khả dụng.</p> : null}
        <div className="service-list">
          {services.map((service) => (
            <button key={service.id} type="button" className={`service-card ${selectedServiceId === service.id ? 'selected' : ''}`} onClick={() => onSelectService(service.id)}>
              <span className="service-code">{service.code}</span>
              <span className="service-copy">
                <strong>{service.name}</strong>
                <span>{service.description ?? 'Dịch vụ mô phỏng'}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <SectionTitle title="Thông tin người đăng ký" />
        <label htmlFor="full-name">Họ và tên</label>
        <input id="full-name" value={fullName} onChange={(event) => onFullNameChange(event.target.value)} placeholder="Nhập họ và tên" />
      </section>

      <button type="button" className="primary-button" onClick={onSubmit} disabled={submitting || !hasText(fullName) || !hasText(bookingDate) || !hasText(selectedAreaId) || !hasText(selectedServiceId)}>
        {submitting ? 'Đang đặt số...' : 'Xác nhận đặt số'}
      </button>
    </section>
  );
}

export function BookingDetailScreen({
  booking,
  cancelling,
  onCancel,
  onHome,
}: {
  readonly booking: QmsTicketDto;
  readonly cancelling: boolean;
  readonly onCancel: () => void;
  readonly onHome: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(booking.qrPayload, { width: 192, margin: 1 }).then((url) => {
      if (active) {
        setQrUrl(url);
      }
    });
    return () => {
      active = false;
    };
  }, [booking.qrPayload]);

  return (
    <section className="flow-screen">
      <header className="screen-header">
        <button type="button" className="back-button" onClick={onHome} aria-label="Quay lại">←</button>
        <div>
          <p className="screen-title">Số đã đặt</p>
          <h1>Phiếu đăng ký</h1>
          <p>Thông tin chi tiết lượt đặt của bạn</p>
        </div>
      </header>
      <section className="status-pill confirmed">Đã xác nhận</section>
      <section className="qr-card">
        {qrUrl !== null ? <img src={qrUrl} alt="Mã QR của phiếu" /> : <span>Đang tạo QR...</span>}
      </section>
      <section className="ticket-detail-card">
        <h2>#{booking.ticketNumber}</h2>
        <dl>
          <div><dt>Mã phiếu</dt><dd>{booking.ticketId}</dd></div>
          <div><dt>Đơn vị</dt><dd>{booking.locationName}</dd></div>
          <div><dt>Lĩnh vực</dt><dd>{booking.areaName}</dd></div>
          <div><dt>Dịch vụ</dt><dd>{booking.serviceName}</dd></div>
          <div><dt>Họ và tên</dt><dd>{booking.fullName}</dd></div>
          <div><dt>Ngày đăng ký</dt><dd>{booking.bookingDate}</dd></div>
          <div><dt>Thời gian tạo</dt><dd>{formatDateTime(booking.createdAt)}</dd></div>
          <div><dt>Trạng thái</dt><dd>{booking.status}</dd></div>
        </dl>
        {booking.canCancel ? (
          <button type="button" className="danger-button" disabled={cancelling} onClick={onCancel}>
            {cancelling ? 'Đang hủy...' : 'Hủy lượt'}
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={onHome}>Về trang chủ</button>
      </section>
    </section>
  );
}

function HistoryScreen({
  currentBooking,
  history,
  loading,
  onBack,
}: {
  readonly currentBooking: QmsTicketDto | null;
  readonly history: readonly QmsTicketDto[];
  readonly loading: boolean;
  readonly onBack: () => void;
}) {
  return (
    <section className="flow-screen">
      <header className="screen-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="Quay lại">←</button>
        <div>
          <p className="screen-title">Số đã đặt</p>
          <h1>Lịch sử đặt số</h1>
          <p>Phiếu đang hoạt động và các lượt trước đó</p>
        </div>
      </header>
      {loading ? <LoadingState label="Đang tải dữ liệu..." /> : null}
      {currentBooking === null ? (
        <section className="empty-card">
          <h2>Chưa có phiếu đang hoạt động</h2>
          <p>Hãy tạo một lượt đặt mới để hiển thị phiếu hiện tại.</p>
        </section>
      ) : (
        <article className="ticket-card">
          <strong>#{currentBooking.ticketNumber}</strong>
          <span>{currentBooking.locationName}</span>
          <span>{currentBooking.areaName}</span>
          <span>{currentBooking.serviceName}</span>
          <span>{currentBooking.fullName}</span>
        </article>
      )}
      <section className="section-block">
        <SectionTitle title="Lịch sử đặt số" subtitle="Các phiếu trước" />
        {history.length === 0 ? <p>Chưa có lịch sử.</p> : history.map((ticket) => <article key={ticket.ticketId} className="ticket-card"><strong>#{ticket.ticketNumber}</strong><span>{ticket.serviceName}</span><span>{ticket.status}</span></article>)}
      </section>
    </section>
  );
}

function QueueScreen({ location, queueStatus, loading, onBack, onRefresh }: { readonly location: LocationModel | null; readonly queueStatus: QmsQueueStatusDto | null; readonly loading: boolean; readonly onBack: () => void; readonly onRefresh: () => void; }) {
  return (
    <section className="flow-screen">
      <header className="screen-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="Quay lại">←</button>
        <div>
          <p className="screen-title">Tình hình số thứ tự</p>
          <h1>{location?.name ?? 'Chọn đơn vị'}</h1>
          <p>{location?.address ?? 'Chưa có địa điểm'}</p>
        </div>
      </header>
      <button type="button" className="secondary-button" onClick={onRefresh}>Làm mới</button>
      {loading ? <LoadingState label="Đang tải tình hình..." /> : null}
      {queueStatus !== null ? (
        <>
          <section className="section-block">
            <SectionTitle title="Danh sách quầy" subtitle="Quầy phục vụ" />
            <div className="counter-list">
              {queueStatus.counters.map((counter) => (
                <article key={counter.counterId} className="counter-card">
                  <strong>{counter.counterName}</strong>
                  <span>{counter.status}</span>
                  <span>Đang gọi: {counter.currentTicketNumber ?? 'Chưa có'}</span>
                  <span>Dịch vụ: {counter.servingServiceName ?? 'Chưa phục vụ'}</span>
                  <span>Cập nhật: {formatDateTime(counter.updatedAt)}</span>
                </article>
              ))}
            </div>
          </section>
          <section className="section-block">
            <SectionTitle title="Danh sách chờ" subtitle="Đang chờ" />
            {queueStatus.waitingTickets.length === 0 ? <p>Chưa có vé chờ.</p> : queueStatus.waitingTickets.map((ticket) => <article key={ticket.ticketId} className="ticket-card"><strong>#{ticket.ticketNumber}</strong><span>{ticket.serviceName}</span><span>{ticket.status}</span></article>)}
          </section>
        </>
      ) : null}
    </section>
  );
}

export function App({ apiClient, initializeRuntime }: AppProps = {}) {
  const api = useMemo(() => apiClient ?? createQmsApiClient(), [apiClient]);
  const [runtimeState, setRuntimeState] = useState<ZaloRuntimeState>({ phase: 'initializing' });
  const [screen, setScreen] = useState<Screen>('home');
  const [loading, setLoading] = useState<LoadingTarget>('bootstrap');
  const [error, setError] = useState<UiError | null>(null);
  const [locations, setLocations] = useState<readonly LocationModel[]>([]);
  const [areas, setAreas] = useState<readonly AreaModel[]>([]);
  const [services, setServices] = useState<readonly ServiceModel[]>([]);
  const [currentBooking, setCurrentBooking] = useState<QmsTicketDto | null>(null);
  const [bookingHistory, setBookingHistory] = useState<readonly QmsTicketDto[]>([]);
  const [queueStatus, setQueueStatus] = useState<QmsQueueStatusDto | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationModel | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [fullName, setFullName] = useState('');
  const [bookingDate, setBookingDate] = useState(() => toLocalDateValue(new Date()));
  const bookingInFlight = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const navigate = useCallback((nextScreen: Screen) => {
    window.history.pushState({ qmsScreen: nextScreen }, '', window.location.href);
    setScreen(nextScreen);
  }, []);

  const loadLocations = useCallback(async () => {
    setLoading('locations');
    setError(null);
    try {
      const result = await api.getLocations(requestController.current?.signal);
      setLocations(result.map(mapLocation));
      return result;
    } catch (caught) {
      setError(mapApiError(caught, 'locations'));
      return [];
    } finally {
      setLoading(null);
    }
  }, [api]);

  const loadAreas = useCallback(async (location: LocationModel) => {
    setLoading('areas');
    setError(null);
    setSelectedLocation(location);
    setSelectedAreaId('');
    setSelectedServiceId('');
    setAreas([]);
    setServices([]);
    try {
      const loadedAreas = await api.getAreas(location.id, requestController.current?.signal);
      setAreas(loadedAreas.map(mapArea));
      return loadedAreas;
    } catch (caught) {
      setError(mapApiError(caught, 'areas'));
      return [] as readonly QmsAreaDto[];
    } finally {
      setLoading(null);
    }
  }, [api]);

  const loadServices = useCallback(async (areaId: string) => {
    setSelectedAreaId(areaId);
    setSelectedServiceId('');
    setServices([]);
    if (selectedLocation === null) {
      return;
    }
    setLoading('services');
    setError(null);
    try {
      const loadedServices = await api.getServices(
        selectedLocation.id,
        areaId,
        requestController.current?.signal,
      );
      setServices(loadedServices.map(mapService));
    } catch (caught) {
      setError(mapApiError(caught, 'services'));
    } finally {
      setLoading(null);
    }
  }, [api, selectedLocation]);

  const loadQueue = useCallback(async (locationId: string) => {
    setLoading('queue');
    setError(null);
    const matchedLocation = locations.find((item) => item.id === locationId) ?? null;
    setSelectedLocation(matchedLocation);
    try {
      const result = await api.getQueueStatus(locationId, requestController.current?.signal);
      setQueueStatus(result);
    } catch (caught) {
      setError(mapApiError(caught, 'queue'));
    } finally {
      setLoading(null);
    }
  }, [api, locations]);

  const loadHistory = useCallback(async (locationId: string) => {
    setLoading('history');
    setError(null);
    const matchedLocation = locations.find((item) => item.id === locationId) ?? null;
    setSelectedLocation(matchedLocation);
    try {
      const [current, history] = await Promise.all([
        api.getCurrentBooking(locationId, requestController.current?.signal),
        api.listBookingHistory(locationId, requestController.current?.signal),
      ]);
      setCurrentBooking(current);
      setBookingHistory(history);
    } catch (caught) {
      setError(mapApiError(caught, 'history'));
    } finally {
      setLoading(null);
    }
  }, [api, locations]);

  useEffect(() => {
    requestController.current = new AbortController();
    return () => {
      requestController.current?.abort();
      requestController.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (initializeRuntime ?? (() => initializeZaloRuntime(getRuntimeConfig())))()
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
    const loadTimer = window.setTimeout(() => {
      void loadLocations();
    }, 0);
    window.history.replaceState({ qmsScreen: 'home' }, '', window.location.href);
    const onPopState = (event: PopStateEvent): void => {
      const historyState = event.state as { readonly qmsScreen?: unknown } | null;
      const nextScreen = historyState?.qmsScreen;
      setScreen(
        nextScreen === 'home' ||
          nextScreen === 'locations' ||
          nextScreen === 'booking' ||
          nextScreen === 'current-booking' ||
          nextScreen === 'history' ||
          nextScreen === 'queue'
          ? nextScreen
          : 'home',
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener('popstate', onPopState);
    };
  }, [loadLocations]);

  const createBooking = useCallback(async () => {
    if (bookingInFlight.current || selectedLocation === null || !hasText(selectedAreaId) || !hasText(selectedServiceId) || !hasText(fullName) || !hasText(bookingDate)) {
      return;
    }
    bookingInFlight.current = true;
    setLoading('booking');
    setError(null);
    try {
      const booking = await api.createBooking({
        locationId: selectedLocation.id,
        areaId: selectedAreaId,
        serviceId: selectedServiceId,
        fullName: fullName.trim(),
        bookingDate,
      }, requestController.current?.signal);
      setCurrentBooking(booking);
      setBookingHistory((current) => [booking, ...current.filter((item) => item.ticketId !== booking.ticketId)]);
      navigate('current-booking');
    } catch (caught) {
      setError(mapApiError(caught, 'booking'));
    } finally {
      bookingInFlight.current = false;
      setLoading(null);
    }
  }, [api, bookingDate, fullName, navigate, selectedAreaId, selectedLocation, selectedServiceId]);

  const cancelCurrentBooking = useCallback(async () => {
    if (bookingInFlight.current || currentBooking === null || !currentBooking.canCancel) {
      return;
    }
    if (!window.confirm('Bạn có chắc muốn hủy lượt này?')) {
      return;
    }
    bookingInFlight.current = true;
    setLoading('booking-detail');
    setError(null);
    try {
      const cancelled = await api.cancelTicket(currentBooking.ticketId, requestController.current?.signal);
      setCurrentBooking(cancelled);
      setBookingHistory((current) => [cancelled, ...current.filter((item) => item.ticketId !== cancelled.ticketId)]);
    } catch (caught) {
      setError(mapApiError(caught, 'booking-detail'));
    } finally {
      bookingInFlight.current = false;
      setLoading(null);
    }
  }, [api, currentBooking]);

  const retry = useCallback(() => {
    if (error === null) {
      return;
    }
    if (error.retryTarget === 'locations') {
      void loadLocations();
      return;
    }
    if (error.retryTarget === 'areas' && selectedLocation !== null) {
      void loadAreas(selectedLocation);
      return;
    }
    if (error.retryTarget === 'services' && selectedLocation !== null) {
      void loadServices(selectedAreaId);
      return;
    }
    if (error.retryTarget === 'queue' && selectedLocation !== null) {
      void loadQueue(selectedLocation.id);
      return;
    }
    if (error.retryTarget === 'history' && selectedLocation !== null) {
      void loadHistory(selectedLocation.id);
      return;
    }
  }, [error, loadAreas, loadHistory, loadLocations, loadQueue, loadServices, selectedAreaId, selectedLocation]);

  return (
    <main className="app-shell">
      <section className="runtime-strip" aria-label="Trạng thái runtime">
        {runtimeState.phase === 'initializing'
          ? 'Đang khởi tạo...'
          : runtimeState.phase === 'ready' && runtimeState.runtime === 'browser-development'
            ? 'Chế độ phát triển trình duyệt'
            : runtimeState.phase === 'ready'
              ? 'Đang chạy trong Zalo Mini App'
              : runtimeState.phase === 'configuration-error'
                ? 'Cấu hình Zalo Mini App chưa đầy đủ'
                : 'Không hỗ trợ runtime hiện tại'}
      </section>
      {error !== null && error.retryTarget !== 'areas' && error.retryTarget !== 'services'
        ? <ErrorBanner error={error} onRetry={retry} />
        : null}
      {screen === 'home' ? (
        <HomeBanner
          onGoBooking={() => navigate('locations')}
          onGoHistory={() => {
            navigate('history');
            const locationId = selectedLocation?.id ?? locations[0]?.id;
            if (locationId !== undefined) {
              void loadHistory(locationId);
            }
          }}
          onGoQueue={() => {
            navigate('queue');
            const locationId = selectedLocation?.id ?? locations[0]?.id;
            if (locationId !== undefined) {
              void loadQueue(locationId);
            }
          }}
        />
      ) : null}
      {screen === 'locations' ? (
        <section className="flow-screen">
          <header className="screen-header">
            <button type="button" className="back-button" onClick={() => setScreen('home')} aria-label="Quay lại">←</button>
            <div>
              <p className="screen-title">Đặt số trực tuyến</p>
              <h1>Chọn đơn vị</h1>
              <p>Chọn địa điểm để tiếp tục</p>
            </div>
          </header>
          {loading === 'locations' ? <LoadingState label="Đang tải danh sách địa điểm..." /> : null}
          <LocationPicker locations={locations} onSelect={(location) => { void loadAreas(location).then(() => navigate('booking')); }} />
        </section>
      ) : null}
      {screen === 'booking' && selectedLocation !== null ? (
        <BookingScreen
          location={selectedLocation}
          areas={areas}
          services={services}
          selectedAreaId={selectedAreaId}
          selectedServiceId={selectedServiceId}
          fullName={fullName}
          bookingDate={bookingDate}
          loadingArea={loading === 'areas'}
          loadingService={loading === 'services'}
          submitting={loading === 'booking'}
          areaError={error?.retryTarget === 'areas' ? error : null}
          serviceError={error?.retryTarget === 'services' ? error : null}
          onBack={() => setScreen('locations')}
          onSelectArea={(areaId) => void loadServices(areaId)}
          onSelectService={(serviceId) => setSelectedServiceId(serviceId)}
          onFullNameChange={setFullName}
          onBookingDateChange={setBookingDate}
          onSubmit={() => void createBooking()}
          onRetry={retry}
        />
      ) : null}
      {screen === 'current-booking' && currentBooking !== null ? (
        <BookingDetailScreen
          booking={currentBooking}
          cancelling={loading === 'booking-detail'}
          onCancel={() => void cancelCurrentBooking()}
          onHome={() => navigate('home')}
        />
      ) : null}
      {screen === 'history' && selectedLocation !== null ? (
        <HistoryScreen
          currentBooking={currentBooking}
          history={bookingHistory}
          loading={loading === 'history'}
          onBack={() => setScreen('home')}
        />
      ) : null}
      {screen === 'queue' ? (
        <QueueScreen
          location={selectedLocation}
          queueStatus={queueStatus}
          loading={loading === 'queue'}
          onBack={() => setScreen('home')}
          onRefresh={() => {
            if (selectedLocation !== null) {
              void loadQueue(selectedLocation.id);
            }
          }}
        />
      ) : null}
      {loading === 'bootstrap' ? <LoadingState label="Đang tải danh mục..." /> : null}
    </main>
  );
}
