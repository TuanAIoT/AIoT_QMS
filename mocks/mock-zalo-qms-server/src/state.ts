import { randomUUID } from 'node:crypto';

export const ZALO_QMS_AREAS = [
  { areaId: 'area-justice', areaName: 'Tư pháp, hộ tịch' },
  { areaId: 'area-social', areaName: 'Văn hóa, xã hội' },
  { areaId: 'area-business', areaName: 'Doanh nghiệp, pháp luật, công an' },
  { areaId: 'area-other', areaName: 'Các lĩnh vực khác' },
] as const;

export const ZALO_QMS_LOCATIONS: readonly {
  readonly locationId: string;
  readonly locationName: string;
  readonly address: string;
}[] = [
  {
    locationId: 'loc-cumta',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA',
    address: '01 Đường Mô Phỏng, Xã Cư Mta, Tỉnh Đắk Lắk',
  },
  {
    locationId: 'loc-aiot',
    locationName: 'AIoT Making Innovation',
    address: 'Khu thử nghiệm AIoT, Thành phố Hồ Chí Minh',
  },
  {
    locationId: 'loc-xuanphuong',
    locationName: 'UBND Phường Xuân Phương',
    address: 'Số 12 Phố Trịnh Văn Bô, Phường Xuân Phương, Hà Nội',
  },
  {
    locationId: 'loc-namtuliem',
    locationName: 'Trung tâm Hành chính công Quận Nam Từ Liêm',
    address: 'Đường Nguyễn Cơ Thạch, Quận Nam Từ Liêm, Hà Nội',
  },
  {
    locationId: 'loc-eaktur',
    locationName: 'Bộ phận Một cửa Xã Ea Ktur',
    address: 'Thôn 5, Xã Ea Ktur, Huyện Cư Kuin, Đắk Lắk',
  },
  {
    locationId: 'loc-hanoi-center',
    locationName: 'Trung tâm Phục vụ hành chính công Thành phố Hà Nội',
    address: '258 Võ Chí Công, Tây Hồ, Hà Nội',
  },
  {
    locationId: 'loc-tanlap',
    locationName: 'UBND Xã Tân Lập',
    address: 'Khu trung tâm xã Tân Lập, Huyện Đan Phượng, Hà Nội',
  },
  {
    locationId: 'loc-donganh',
    locationName: 'Phòng Tiếp nhận và Trả kết quả Huyện Đông Anh',
    address: 'Tổ 3 Thị trấn Đông Anh, Huyện Đông Anh, Hà Nội',
  },
  {
    locationId: 'loc-daklak-center',
    locationName: 'Trung tâm Dịch vụ công Tỉnh Đắk Lắk',
    address: '09 Nguyễn Tất Thành, Thành phố Buôn Ma Thuột, Đắk Lắk',
  },
  {
    locationId: 'loc-hightech',
    locationName: 'Điểm tiếp nhận hồ sơ Khu công nghệ cao',
    address: 'Lô E2a, Khu công nghệ cao, Thành phố Thủ Đức, Thành phố Hồ Chí Minh',
  },
  {
    locationId: 'loc-thuduc-long',
    locationName: 'Trung tâm Hỗ trợ thủ tục hành chính và tiếp nhận hồ sơ liên thông Thành phố Thủ Đức',
    address: '01 Đường Sáng Tạo, Phường Hiệp Phú, Thành phố Thủ Đức, Thành phố Hồ Chí Minh',
  },
  {
    locationId: 'loc-baodai',
    locationName: 'Điểm giao dịch hành chính lưu động Khu dân cư Bắc Đại lộ Thăng Long',
    address: 'Lô B7 Đại lộ Thăng Long, Hoài Đức, Hà Nội',
  },
];

export const ZALO_QMS_SERVICES: readonly {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceName: string;
  readonly areaId: string;
  readonly locationId: string;
  readonly description: string;
  readonly bookingEnabled: true;
}[] = [
  { serviceId: 'svc-justice-1', serviceCode: 'A01', serviceName: 'Khai sinh, khai tử', areaId: 'area-justice', locationId: 'loc-cumta', description: 'Tiếp nhận hộ tịch', bookingEnabled: true },
  { serviceId: 'svc-social-1', serviceCode: 'B01', serviceName: 'Văn hóa, xã hội', areaId: 'area-social', locationId: 'loc-cumta', description: 'Dịch vụ văn hóa', bookingEnabled: true },
  { serviceId: 'svc-business-1', serviceCode: 'C01', serviceName: 'Đăng ký doanh nghiệp', areaId: 'area-business', locationId: 'loc-cumta', description: 'Hỗ trợ pháp lý', bookingEnabled: true },
  { serviceId: 'svc-other-1', serviceCode: 'D01', serviceName: 'Lĩnh vực khác', areaId: 'area-other', locationId: 'loc-cumta', description: 'Dịch vụ khác', bookingEnabled: true },
  { serviceId: 'svc-aiot-1', serviceCode: 'A02', serviceName: 'Tổng hợp AIoT', areaId: 'area-justice', locationId: 'loc-aiot', description: 'Dịch vụ thử nghiệm', bookingEnabled: true },
  { serviceId: 'svc-aiot-2', serviceCode: 'B02', serviceName: 'Hướng dẫn AIoT', areaId: 'area-social', locationId: 'loc-aiot', description: 'Dịch vụ thử nghiệm', bookingEnabled: true },
  { serviceId: 'svc-xuanphuong-1', serviceCode: 'A03', serviceName: 'Chứng thực hồ sơ', areaId: 'area-justice', locationId: 'loc-xuanphuong', description: 'Tiếp nhận hồ sơ chứng thực', bookingEnabled: true },
  { serviceId: 'svc-xuanphuong-2', serviceCode: 'B03', serviceName: 'Hỗ trợ cư trú', areaId: 'area-social', locationId: 'loc-xuanphuong', description: 'Tra cứu và hỗ trợ cư trú', bookingEnabled: true },
  { serviceId: 'svc-namtuliem-1', serviceCode: 'A04', serviceName: 'Đăng ký hộ kinh doanh', areaId: 'area-business', locationId: 'loc-namtuliem', description: 'Tiếp nhận hồ sơ kinh doanh', bookingEnabled: true },
  { serviceId: 'svc-eaktur-1', serviceCode: 'A05', serviceName: 'Xác nhận thông tin hộ tịch', areaId: 'area-justice', locationId: 'loc-eaktur', description: 'Xác nhận và cập nhật hộ tịch', bookingEnabled: true },
  { serviceId: 'svc-hanoi-center-1', serviceCode: 'A06', serviceName: 'Tiếp nhận hồ sơ trực tuyến', areaId: 'area-other', locationId: 'loc-hanoi-center', description: 'Hỗ trợ nộp hồ sơ dịch vụ công', bookingEnabled: true },
  { serviceId: 'svc-tanlap-1', serviceCode: 'A07', serviceName: 'Đăng ký khai sinh', areaId: 'area-justice', locationId: 'loc-tanlap', description: 'Tiếp nhận khai sinh tại xã', bookingEnabled: true },
  { serviceId: 'svc-donganh-1', serviceCode: 'A08', serviceName: 'Trả kết quả hồ sơ', areaId: 'area-social', locationId: 'loc-donganh', description: 'Nhận và trả kết quả hành chính', bookingEnabled: true },
  { serviceId: 'svc-daklak-center-1', serviceCode: 'A09', serviceName: 'Tiếp nhận hồ sơ cấp tỉnh', areaId: 'area-other', locationId: 'loc-daklak-center', description: 'Hướng dẫn thủ tục cấp tỉnh', bookingEnabled: true },
  { serviceId: 'svc-hightech-1', serviceCode: 'A10', serviceName: 'Hỗ trợ doanh nghiệp công nghệ', areaId: 'area-business', locationId: 'loc-hightech', description: 'Tiếp nhận hồ sơ doanh nghiệp công nghệ', bookingEnabled: true },
  { serviceId: 'svc-thuduc-long-1', serviceCode: 'A11', serviceName: 'Tiếp nhận liên thông thủ tục', areaId: 'area-other', locationId: 'loc-thuduc-long', description: 'Hỗ trợ hồ sơ liên thông nhiều cấp', bookingEnabled: true },
  { serviceId: 'svc-baodai-1', serviceCode: 'A12', serviceName: 'Tiếp nhận lưu động', areaId: 'area-social', locationId: 'loc-baodai', description: 'Điểm tiếp nhận hồ sơ lưu động', bookingEnabled: true },
];

export type ZaloQmsArea = (typeof ZALO_QMS_AREAS)[number];
export type ZaloQmsLocationArea = ZaloQmsArea & { readonly locationId: string };
export type ZaloQmsService = (typeof ZALO_QMS_SERVICES)[number];
export type ZaloQmsLocation = (typeof ZALO_QMS_LOCATIONS)[number];
export type ZaloQmsTicketStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type ZaloQmsCounterStatus = 'OPEN' | 'CLOSED';

export interface ZaloQmsTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly fullName: string;
  readonly bookingDate: string;
  readonly status: ZaloQmsTicketStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly checkInExpiresAt: string;
  readonly qrPayload: string;
  readonly canCancel: boolean;
}

export interface ZaloQmsCounter {
  readonly counterId: string;
  readonly counterName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly status: ZaloQmsCounterStatus;
  readonly currentTicket: ZaloQmsQueueTicket | null;
  readonly nextTicket: ZaloQmsQueueTicket | null;
  readonly waitingCount: number;
  readonly waitingTickets: readonly ZaloQmsQueueTicket[];
  readonly updatedAt: string;
}

export interface ZaloQmsQueueTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly serviceName: string;
}

export interface ZaloQmsQueueStatus {
  readonly locationId: string;
  readonly locationName: string;
  readonly updatedAt: string;
  readonly counters: readonly ZaloQmsCounter[];
}

export class MockZaloQmsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MockZaloQmsError';
  }
}

interface StoredTicket extends ZaloQmsTicket {
  status: ZaloQmsTicketStatus;
  updatedAt: string;
  canCancel: boolean;
}

function toIso(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function serviceById(serviceId: string): ZaloQmsService {
  const service = ZALO_QMS_SERVICES.find((candidate) => candidate.serviceId === serviceId);
  if (service === undefined) {
    throw new MockZaloQmsError(400, 'UNKNOWN_SERVICE', 'Dịch vụ không hợp lệ.');
  }
  return service;
}

function areaById(areaId: string): ZaloQmsArea {
  const area = ZALO_QMS_AREAS.find((candidate) => candidate.areaId === areaId);
  if (area === undefined) {
    throw new MockZaloQmsError(400, 'UNKNOWN_AREA', 'Lĩnh vực không hợp lệ.');
  }
  return area;
}

function locationById(locationId: string): ZaloQmsLocation {
  const location = ZALO_QMS_LOCATIONS.find((candidate) => candidate.locationId === locationId);
  if (location === undefined) {
    throw new MockZaloQmsError(404, 'LOCATION_NOT_FOUND', 'Không tìm thấy địa điểm.');
  }
  return location;
}

interface StoredCounter {
  counterId: string;
  counterName: string;
  locationId: string;
  serviceId: string;
  serviceName: string;
  status: ZaloQmsCounterStatus;
  currentTicketId: string | null;
  updatedAt: string;
}

function createLocationCounters(locationId: string): StoredCounter[] {
  return ZALO_QMS_SERVICES.filter((service) => service.locationId === locationId).map((service, index) => ({
    counterId: `${locationId}-counter-${String(index + 1).padStart(2, '0')}`,
    counterName: `Quầy ${String(index + 1).padStart(2, '0')}`,
    locationId,
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    status: 'OPEN',
    currentTicketId: null,
    updatedAt: toIso(),
  }));
}

export class MockZaloQmsState {
  private tickets: StoredTicket[] = [];
  private countersByLocation = new Map<string, StoredCounter[]>();
  private counters = new Map<string, number>();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.tickets = [];
    this.counters = new Map(ZALO_QMS_LOCATIONS.map((location) => [location.locationId, 0]));
    this.countersByLocation = new Map(ZALO_QMS_LOCATIONS.map((location) => [location.locationId, createLocationCounters(location.locationId)]));
  }

  listLocations(): readonly ZaloQmsLocation[] {
    return ZALO_QMS_LOCATIONS;
  }

  getLocation(locationId: string): ZaloQmsLocation {
    return locationById(locationId);
  }

  listAreas(locationId: string): readonly ZaloQmsLocationArea[] {
    locationById(locationId);
    return ZALO_QMS_AREAS.map((area) => ({ ...area, locationId }));
  }

  listServices(locationId: string, areaId?: string): readonly ZaloQmsService[] {
    locationById(locationId);
    return ZALO_QMS_SERVICES.filter((service) => service.locationId === locationId).filter((service) =>
      areaId === undefined ? true : service.areaId === areaId,
    );
  }

  createBooking(locationId: string, areaId: string, serviceId: string, fullName: string, bookingDate: string): ZaloQmsTicket {
    const location = locationById(locationId);
    const area = areaById(areaId);
    const service = serviceById(serviceId);
    if (service.locationId !== location.locationId || service.areaId !== area.areaId) {
      throw new MockZaloQmsError(409, 'SERVICE_MISMATCH', 'Dịch vụ không khớp với lĩnh vực hoặc đơn vị.');
    }
    const next = (this.counters.get(location.locationId) ?? 0) + 1;
    this.counters.set(location.locationId, next);
    const now = toIso();
    const ticketId = `ticket-${randomUUID()}`;
    const ticket: StoredTicket = {
      ticketId,
      ticketNumber: String(next).padStart(4, '0'),
      locationId: location.locationId,
      locationName: location.locationName,
      areaId: area.areaId,
      areaName: area.areaName,
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      fullName,
      bookingDate,
      status: 'WAITING',
      createdAt: now,
      updatedAt: now,
      checkInExpiresAt: toIso(45),
      qrPayload: JSON.stringify({ ticketId, locationId: location.locationId, issuedAt: now, expiresAt: toIso(45) }),
      canCancel: true,
    };
    this.tickets.push(ticket);
    return this.toPublicTicket(ticket);
  }

  listTickets(locationId?: string, status?: ZaloQmsTicketStatus): readonly ZaloQmsTicket[] {
    return this.tickets
      .filter((ticket) => (locationId === undefined ? true : ticket.locationId === locationId))
      .filter((ticket) => (status === undefined ? true : ticket.status === status))
      .map((ticket) => this.toPublicTicket(ticket))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  getCurrentBooking(locationId: string): ZaloQmsTicket | null {
    const ticket = this.tickets.find((candidate) => candidate.locationId === locationId && candidate.status !== 'CANCELLED' && candidate.status !== 'COMPLETED' && candidate.status !== 'EXPIRED');
    return ticket === undefined ? null : this.toPublicTicket(ticket);
  }

  getTicket(ticketId: string): ZaloQmsTicket {
    const ticket = this.tickets.find((candidate) => candidate.ticketId === ticketId);
    if (ticket === undefined) {
      throw new MockZaloQmsError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    }
    return this.toPublicTicket(ticket);
  }

  listHistory(locationId: string): readonly ZaloQmsTicket[] {
    locationById(locationId);
    return this.tickets
      .filter((ticket) => ticket.locationId === locationId && ticket.status !== 'WAITING')
      .map((ticket) => this.toPublicTicket(ticket))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  cancelTicket(ticketId: string): ZaloQmsTicket {
    const ticket = this.findTicket(ticketId);
    if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' || ticket.status === 'EXPIRED') {
      throw new MockZaloQmsError(409, 'TICKET_TERMINAL', 'Vé đã ở trạng thái cuối.');
    }
    ticket.status = 'CANCELLED';
    ticket.updatedAt = toIso();
    ticket.canCancel = false;
    this.releaseCounter(ticket);
    return this.toPublicTicket(ticket);
  }

  getQueueStatus(locationId: string): ZaloQmsQueueStatus {
    const location = locationById(locationId);
    const counters = this.countersByLocation.get(locationId) ?? [];
    return {
      locationId: location.locationId,
      locationName: location.locationName,
      updatedAt: toIso(),
      counters: counters.map((counter) => {
        const waiting = this.tickets
          .filter((ticket) => ticket.locationId === locationId && ticket.serviceId === counter.serviceId && ticket.status === 'WAITING')
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        const current = counter.currentTicketId === null ? undefined : this.tickets.find((ticket) => ticket.ticketId === counter.currentTicketId);
        return {
          counterId: counter.counterId,
          counterName: counter.counterName,
          serviceId: counter.serviceId,
          serviceName: counter.serviceName,
          status: counter.status,
          currentTicket: current === undefined ? null : this.toQueueTicket(current),
          nextTicket: waiting[0] === undefined ? null : this.toQueueTicket(waiting[0]),
          waitingCount: waiting.length,
          waitingTickets: waiting.slice(0, 20).map((ticket) => this.toQueueTicket(ticket)),
          updatedAt: counter.updatedAt,
        };
      }),
    };
  }

  callNext(locationId?: string): ZaloQmsTicket | null {
    return this.tickQueueSimulation(locationId)[0] ?? null;
  }

  tickQueueSimulation(locationId?: string): readonly ZaloQmsTicket[] {
    const changed: ZaloQmsTicket[] = [];
    const counters = [...this.countersByLocation.values()].flat().filter((counter) =>
      locationId === undefined ? true : counter.locationId === locationId,
    );
    for (const counter of counters) {
      if (counter.status !== 'OPEN') continue;
      if (counter.currentTicketId !== null) {
        const current = this.tickets.find((ticket) => ticket.ticketId === counter.currentTicketId);
        if (current !== undefined) {
          current.status = 'COMPLETED';
          current.canCancel = false;
          current.updatedAt = toIso();
          changed.push(this.toPublicTicket(current));
        }
        counter.currentTicketId = null;
      } else {
        const next = this.tickets.find((ticket) =>
          ticket.locationId === counter.locationId && ticket.serviceId === counter.serviceId && ticket.status === 'WAITING',
        );
        if (next !== undefined) {
          next.status = 'SERVING';
          next.canCancel = false;
          next.updatedAt = toIso();
          counter.currentTicketId = next.ticketId;
          changed.push(this.toPublicTicket(next));
        }
      }
      counter.updatedAt = toIso();
    }
    return changed;
  }

  private findTicket(ticketId: string): StoredTicket {
    const ticket = this.tickets.find((candidate) => candidate.ticketId === ticketId);
    if (ticket === undefined) {
      throw new MockZaloQmsError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    }
    return ticket;
  }

  private releaseCounter(ticket: StoredTicket): void {
    const counters = this.countersByLocation.get(ticket.locationId);
    if (counters === undefined) {
      return;
    }
    const counter = counters.find((candidate) => candidate.currentTicketId === ticket.ticketId);
    if (counter !== undefined) {
      counter.currentTicketId = null;
      counter.updatedAt = toIso();
    }
  }

  private toQueueTicket(ticket: StoredTicket): ZaloQmsQueueTicket {
    return { ticketId: ticket.ticketId, ticketNumber: ticket.ticketNumber, serviceName: ticket.serviceName };
  }

  private toPublicTicket(ticket: StoredTicket): ZaloQmsTicket {
    return {
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      locationId: ticket.locationId,
      locationName: ticket.locationName,
      areaId: ticket.areaId,
      areaName: ticket.areaName,
      serviceId: ticket.serviceId,
      serviceName: ticket.serviceName,
      fullName: ticket.fullName,
      bookingDate: ticket.bookingDate,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      checkInExpiresAt: ticket.checkInExpiresAt,
      qrPayload: ticket.qrPayload,
      canCancel: ticket.canCancel,
    };
  }
}
