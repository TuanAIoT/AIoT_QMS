import { randomUUID } from 'node:crypto';

export const ZALO_QMS_SERVICES = [
  { serviceId: 'svc-med', serviceCode: 'A', serviceName: 'Khám bệnh', description: 'Dịch vụ khám tổng quát' },
  { serviceId: 'svc-pay', serviceCode: 'B', serviceName: 'Thanh toán', description: 'Thanh toán phí dịch vụ' },
  { serviceId: 'svc-consult', serviceCode: 'C', serviceName: 'Tư vấn', description: 'Tư vấn thủ tục và hướng dẫn' },
  { serviceId: 'svc-records', serviceCode: 'D', serviceName: 'Hồ sơ hành chính', description: 'Tiếp nhận và xử lý hồ sơ' },
  { serviceId: 'svc-cert', serviceCode: 'E', serviceName: 'Chứng thực', description: 'Chứng thực giấy tờ' },
] as const;

export const ZALO_QMS_LOCATIONS = [
  {
    locationId: 'loc-cumta',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA',
    address: '01 Đường Mô Phỏng, Xã Cư Mta, Tỉnh Đắk Lắk',
  },
  {
    locationId: 'loc-earieng',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ EA RIÊNG',
    address: '02 Đường Mô Phỏng, Xã Ea Riêng, Tỉnh Đắk Lắk',
  },
  {
    locationId: 'loc-eatrang',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ EA TRANG',
    address: '03 Đường Mô Phỏng, Xã Ea Trang, Tỉnh Đắk Lắk',
  },
  {
    locationId: 'loc-phutho',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG PHƯỜNG PHÚ THỌ',
    address: '04 Đường Mô Phỏng, Phường Phú Thọ, Tỉnh Bình Dương',
  },
  {
    locationId: 'loc-tanminh',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ TÂN MINH',
    address: '05 Đường Mô Phỏng, Xã Tân Minh, Tỉnh Bình Thuận',
  },
  {
    locationId: 'loc-aiot',
    locationName: 'AIoT Making Innovation',
    address: 'Khu thử nghiệm AIoT, Thành phố Hồ Chí Minh',
  },
  {
    locationId: 'loc-hoa-binh',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ HÒA BÌNH',
    address: '06 Đường Mô Phỏng, Xã Hòa Bình, Tỉnh Yên Bái',
  },
  {
    locationId: 'loc-tan-lap',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG PHƯỜNG TÂN LẬP',
    address: '07 Đường Mô Phỏng, Phường Tân Lập, Tỉnh Đắk Lắk',
  },
  {
    locationId: 'loc-dong-an',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ ĐÔNG AN',
    address: '08 Đường Mô Phỏng, Xã Đông An, Tỉnh Hưng Yên',
  },
  {
    locationId: 'loc-binh-an',
    locationName: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG PHƯỜNG BÌNH AN',
    address: '09 Đường Mô Phỏng, Phường Bình An, Thành phố Hồ Chí Minh',
  },
] as const;

export type ZaloQmsService = (typeof ZALO_QMS_SERVICES)[number];
export type ZaloQmsLocation = (typeof ZALO_QMS_LOCATIONS)[number];
export type ZaloQmsTicketStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type ZaloQmsCounterStatus = 'OPEN' | 'CLOSED';

export interface ZaloQmsTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly serviceId: string;
  readonly serviceName: string;
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

interface StoredTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  status: ZaloQmsTicketStatus;
  readonly createdAt: string;
  updatedAt: string;
  readonly checkInExpiresAt: string;
  readonly qrPayload: string;
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
    {
      counterId: 'counter-01',
      counterName: 'Quầy 01',
      status: 'OPEN',
      currentTicketNumber: null,
      servingServiceName: null,
      updatedAt: toIso(),
    },
    {
      counterId: 'counter-02',
      counterName: 'Quầy 02',
      status: 'OPEN',
      currentTicketNumber: null,
      servingServiceName: null,
      updatedAt: toIso(),
    },
    {
      counterId: 'counter-03',
      counterName: 'Quầy 03',
      status: 'OPEN',
      currentTicketNumber: null,
      servingServiceName: null,
      updatedAt: toIso(),
    },
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

  listServices(locationId?: string): readonly ZaloQmsService[] {
    if (locationId === undefined) {
      return ZALO_QMS_SERVICES;
    }
    locationById(locationId);
    return ZALO_QMS_SERVICES;
  }

  createTicket(locationId: string, serviceId: string): ZaloQmsTicket {
    const location = locationById(locationId);
    const service = serviceById(serviceId);
    const next = (this.counters.get(location.locationId) ?? 0) + 1;
    this.counters.set(location.locationId, next);
    const now = toIso();
    const ticketId = `ticket-${randomUUID()}`;
    const ticket: StoredTicket = {
      ticketId,
      ticketNumber: String(next).padStart(4, '0'),
      locationId: location.locationId,
      locationName: location.locationName,
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      status: 'WAITING',
      createdAt: now,
      updatedAt: now,
      checkInExpiresAt: toIso(45),
      qrPayload: JSON.stringify({
        ticketId,
        locationId: location.locationId,
        issuedAt: now,
        expiresAt: toIso(45),
      }),
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

  getTicket(ticketId: string): ZaloQmsTicket {
    const ticket = this.tickets.find((candidate) => candidate.ticketId === ticketId);
    if (ticket === undefined) {
      throw new MockZaloQmsError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    }
    return this.toPublicTicket(ticket);
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
    const ticket = this.tickets.find((candidate) => {
      if (candidate.status !== 'WAITING') {
        return false;
      }
      return locationId === undefined ? true : candidate.locationId === locationId;
    });
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
      serviceId: ticket.serviceId,
      serviceName: ticket.serviceName,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      checkInExpiresAt: ticket.checkInExpiresAt,
      qrPayload: ticket.qrPayload,
      canCancel: ticket.canCancel,
    };
  }
}
