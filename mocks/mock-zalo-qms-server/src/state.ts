import { randomUUID } from 'node:crypto';

export const ZALO_QMS_AREAS = [
  { areaId: 'area-justice', areaName: 'Tư pháp, hộ tịch' },
  { areaId: 'area-social', areaName: 'Văn hóa, xã hội' },
  { areaId: 'area-business', areaName: 'Doanh nghiệp, pháp luật, công an' },
  { areaId: 'area-other', areaName: 'Các lĩnh vực khác' },
] as const;

export const ZALO_QMS_LOCATIONS = [
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
] as const;

export const ZALO_QMS_SERVICES = [
  { serviceId: 'svc-justice-1', serviceCode: 'A01', serviceName: 'Khai sinh, khai tử', areaId: 'area-justice', locationId: 'loc-cumta', description: 'Tiếp nhận hộ tịch', bookingEnabled: true },
  { serviceId: 'svc-social-1', serviceCode: 'B01', serviceName: 'Văn hóa, xã hội', areaId: 'area-social', locationId: 'loc-cumta', description: 'Dịch vụ văn hóa', bookingEnabled: true },
  { serviceId: 'svc-business-1', serviceCode: 'C01', serviceName: 'Đăng ký doanh nghiệp', areaId: 'area-business', locationId: 'loc-cumta', description: 'Hỗ trợ pháp lý', bookingEnabled: true },
  { serviceId: 'svc-other-1', serviceCode: 'D01', serviceName: 'Lĩnh vực khác', areaId: 'area-other', locationId: 'loc-cumta', description: 'Dịch vụ khác', bookingEnabled: true },
  { serviceId: 'svc-aiot-1', serviceCode: 'A02', serviceName: 'Tổng hợp AIoT', areaId: 'area-justice', locationId: 'loc-aiot', description: 'Dịch vụ thử nghiệm', bookingEnabled: true },
  { serviceId: 'svc-aiot-2', serviceCode: 'B02', serviceName: 'Hướng dẫn AIoT', areaId: 'area-social', locationId: 'loc-aiot', description: 'Dịch vụ thử nghiệm', bookingEnabled: true },
] as const;

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
  readonly status: ZaloQmsCounterStatus;
  readonly currentTicketNumber: string | null;
  readonly servingServiceName: string | null;
  readonly updatedAt: string;
}

export interface ZaloQmsQueueStatus {
  readonly locationId: string;
  readonly locationName: string;
  readonly bookingEnabled: boolean;
  readonly currentDate: string;
  readonly counters: readonly ZaloQmsCounter[];
  readonly waitingTickets: readonly ZaloQmsTicket[];
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
  status: ZaloQmsCounterStatus;
  currentTicketNumber: string | null;
  servingServiceName: string | null;
  updatedAt: string;
}

function createCounters(): StoredCounter[] {
  return [
    { counterId: 'counter-01', counterName: 'Quầy 01', status: 'OPEN', currentTicketNumber: null, servingServiceName: null, updatedAt: toIso() },
    { counterId: 'counter-02', counterName: 'Quầy 02', status: 'OPEN', currentTicketNumber: null, servingServiceName: null, updatedAt: toIso() },
    { counterId: 'counter-03', counterName: 'Quầy 03', status: 'OPEN', currentTicketNumber: null, servingServiceName: null, updatedAt: toIso() },
  ];
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
    this.countersByLocation = new Map(ZALO_QMS_LOCATIONS.map((location) => [location.locationId, createCounters()]));
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
    return {
      locationId: location.locationId,
      locationName: location.locationName,
      bookingEnabled: true,
      currentDate: toIso(),
      counters: this.countersByLocation.get(locationId)?.map((counter) => ({ ...counter })) ?? createCounters(),
      waitingTickets: this.tickets
        .filter((ticket) => ticket.locationId === locationId && ticket.status === 'WAITING')
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((ticket) => this.toPublicTicket(ticket)),
    };
  }

  callNext(locationId?: string): ZaloQmsTicket | null {
    const ticket = this.tickets.find((candidate) => candidate.status === 'WAITING' && (locationId === undefined ? true : candidate.locationId === locationId));
    if (ticket === undefined) {
      return null;
    }
    ticket.status = 'CALLED';
    ticket.updatedAt = toIso();
    const counters = this.countersByLocation.get(ticket.locationId);
    if (counters !== undefined) {
      const counter = counters.find((candidate) => candidate.status === 'OPEN') ?? counters[0];
      if (counter !== undefined) {
        counter.currentTicketNumber = ticket.ticketNumber;
        counter.servingServiceName = ticket.serviceName;
        counter.updatedAt = toIso();
      }
    }
    return this.toPublicTicket(ticket);
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
    const counter = counters.find((candidate) => candidate.currentTicketNumber === ticket.ticketNumber);
    if (counter !== undefined) {
      counter.currentTicketNumber = null;
      counter.servingServiceName = null;
      counter.updatedAt = toIso();
    }
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
