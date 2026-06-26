import { randomUUID } from 'node:crypto';

export const ZALO_QMS_SERVICES = [
  { id: 'medical', code: 'A', name: 'Khám bệnh' },
  { id: 'payment', code: 'B', name: 'Thanh toán' },
  { id: 'consulting', code: 'C', name: 'Tư vấn' },
] as const;

export type ZaloQmsService = (typeof ZALO_QMS_SERVICES)[number];
export type ZaloQmsTicketStatus = 'WAITING' | 'CALLED';

export interface ZaloQmsTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  readonly serviceId: ZaloQmsService['id'];
  readonly serviceName: string;
  readonly status: ZaloQmsTicketStatus;
  readonly waitingAhead: number;
  readonly createdAt: string;
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
  readonly serviceId: ZaloQmsService['id'];
  readonly serviceName: string;
  status: ZaloQmsTicketStatus;
  readonly createdAt: string;
}

function serviceById(serviceId: string): ZaloQmsService {
  const service = ZALO_QMS_SERVICES.find((candidate) => candidate.id === serviceId);
  if (service === undefined) {
    throw new MockZaloQmsError(400, 'UNKNOWN_SERVICE', 'Dịch vụ không hợp lệ.');
  }
  return service;
}

export class MockZaloQmsState {
  private tickets: StoredTicket[] = [];
  private counters = new Map<ZaloQmsService['id'], number>();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.tickets = [];
    this.counters = new Map(ZALO_QMS_SERVICES.map((service) => [service.id, 0]));
  }

  listServices(): readonly ZaloQmsService[] {
    return ZALO_QMS_SERVICES;
  }

  createTicket(serviceId: string): ZaloQmsTicket {
    const service = serviceById(serviceId);
    const next = (this.counters.get(service.id) ?? 0) + 1;
    this.counters.set(service.id, next);
    const ticket: StoredTicket = {
      ticketId: `ticket-${randomUUID()}`,
      ticketNumber: `${service.code}${String(next).padStart(3, '0')}`,
      serviceId: service.id,
      serviceName: service.name,
      status: 'WAITING',
      createdAt: new Date().toISOString(),
    };
    this.tickets.push(ticket);
    return this.toPublicTicket(ticket);
  }

  getTicket(ticketId: string): ZaloQmsTicket {
    const ticket = this.tickets.find((candidate) => candidate.ticketId === ticketId);
    if (ticket === undefined) {
      throw new MockZaloQmsError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    }
    return this.toPublicTicket(ticket);
  }

  callNext(): ZaloQmsTicket | null {
    const ticket = this.tickets.find((candidate) => candidate.status === 'WAITING');
    if (ticket === undefined) {
      return null;
    }
    ticket.status = 'CALLED';
    return this.toPublicTicket(ticket);
  }

  private toPublicTicket(ticket: StoredTicket): ZaloQmsTicket {
    return {
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      serviceId: ticket.serviceId,
      serviceName: ticket.serviceName,
      status: ticket.status,
      waitingAhead: this.tickets.filter(
        (candidate) =>
          candidate.serviceId === ticket.serviceId &&
          candidate.status === 'WAITING' &&
          candidate.createdAt < ticket.createdAt,
      ).length,
      createdAt: ticket.createdAt,
    };
  }
}
