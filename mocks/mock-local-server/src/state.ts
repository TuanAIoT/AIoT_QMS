import type {
  AssistedTicketRequest,
  CallNextRequest,
  Counter,
  CounterSession,
  Device,
  FinishRequest,
  QueueSummary,
  RecallRequest,
  SkipRequest,
  StartCounterSessionRequest,
  Ticket,
  TransferRequest,
} from '@qms/contracts';
import {
  DEMO_ACTIVE_COUNTER_SESSION,
  DEMO_COUNTERS,
  DEMO_DEVICES,
  DEMO_TICKETS,
} from '@qms/seed-data';

export class MockStateError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MockStateError';
  }
}

function now(): string {
  return new Date().toISOString();
}

export class MockLocalState {
  private ticketSequence = 0;
  private sessionSequence = 0;
  tickets: Ticket[] = [];
  sessions: CounterSession[] = [];
  counters: Counter[] = [];
  devices: Device[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.tickets = DEMO_TICKETS.map((ticket) => ({ ...ticket }));
    this.sessions = [{ ...DEMO_ACTIVE_COUNTER_SESSION }];
    this.counters = DEMO_COUNTERS.map((counter) => ({ ...counter }));
    this.devices = DEMO_DEVICES.map((device) => ({ ...device }));
    this.ticketSequence = this.tickets.length;
    this.sessionSequence = this.sessions.length;
  }

  startCounterSession(request: StartCounterSessionRequest): CounterSession {
    const existing = this.sessions.find(
      (session) => session.counterId === request.counterId && session.status === 'ACTIVE',
    );
    if (existing !== undefined) {
      throw new MockStateError(409, 'ACTIVE_SESSION_EXISTS', 'The counter already has a session.');
    }

    this.sessionSequence += 1;
    const session: CounterSession = {
      id: `session-mock-${String(this.sessionSequence).padStart(3, '0')}`,
      locationId: request.locationId,
      counterId: request.counterId,
      staffId: request.staffId,
      startedAt: now(),
      status: 'ACTIVE',
      ticketsServed: 0,
    };
    this.sessions.push(session);
    return session;
  }

  getActiveCounterSession(locationId: string, counterId: string): CounterSession | null {
    return (
      this.sessions.find(
        (session) =>
          session.locationId === locationId &&
          session.counterId === counterId &&
          session.status === 'ACTIVE',
      ) ?? null
    );
  }

  endCounterSession(locationId: string, sessionId: string): CounterSession {
    const session = this.requireSession(sessionId, locationId);
    if (session.status !== 'ACTIVE') {
      throw new MockStateError(409, 'SESSION_NOT_ACTIVE', 'The counter session is not active.');
    }

    const ended: CounterSession = { ...session, status: 'ENDED', endedAt: now() };
    this.replaceSession(ended);
    return ended;
  }

  getWaitingTickets(locationId: string, counterId?: string, serviceId?: string): Ticket[] {
    return this.tickets.filter(
      (ticket) =>
        ticket.locationId === locationId &&
        ticket.status === 'WAITING' &&
        (counterId === undefined || ticket.counterId === counterId) &&
        (serviceId === undefined || ticket.serviceId === serviceId),
    );
  }

  callNext(request: CallNextRequest): Ticket | null {
    this.requireSession(request.sessionId, request.locationId);
    const ticket = this.tickets.find(
      (candidate) => candidate.locationId === request.locationId && candidate.status === 'WAITING',
    );
    if (ticket === undefined) {
      return null;
    }

    // BACKEND_CONFIRMATION_REQUIRED: The temporary mock transitions WAITING directly to CALLED.
    const called: Ticket = {
      ...ticket,
      counterId: request.counterId,
      sessionId: request.sessionId,
      status: 'CALLED',
      calledAt: now(),
    };
    this.replaceTicket(called);
    return called;
  }

  recall(request: RecallRequest): Ticket {
    this.requireSession(request.sessionId, request.locationId);
    const ticket = this.requireTicket(request.ticketId, request.locationId);
    if (ticket.status !== 'CALLED' && ticket.status !== 'SERVING') {
      throw new MockStateError(409, 'TICKET_NOT_RECALLABLE', 'The ticket cannot be recalled.');
    }
    // BACKEND_CONFIRMATION_REQUIRED: Recall does not mutate the ticket in this temporary mock.
    return ticket;
  }

  skip(request: SkipRequest): Ticket {
    this.requireSession(request.sessionId, request.locationId);
    const ticket = this.requireTicket(request.ticketId, request.locationId);
    const skipped: Ticket = { ...ticket, status: 'SKIPPED' };
    this.replaceTicket(skipped);
    return skipped;
  }

  transfer(request: TransferRequest): Ticket {
    this.requireSession(request.sessionId, request.locationId);
    const ticket = this.requireTicket(request.ticketId, request.locationId);
    // BACKEND_CONFIRMATION_REQUIRED: Destination validation and multi-service rules are pending.
    const transferred: Ticket = {
      ...ticket,
      counterId: request.toCounterId,
      status: 'TRANSFERRED',
      ...(request.nextServiceId === undefined ? {} : { nextServiceId: request.nextServiceId }),
    };
    this.replaceTicket(transferred);
    return transferred;
  }

  finish(request: FinishRequest): Ticket {
    this.requireSession(request.sessionId, request.locationId);
    const ticket = this.requireTicket(request.ticketId, request.locationId);
    const finished: Ticket = { ...ticket, status: 'FINISHED', finishedAt: now() };
    this.replaceTicket(finished);
    return finished;
  }

  createAssistedTicket(request: AssistedTicketRequest): Ticket {
    this.requireSession(request.sessionId, request.locationId);
    this.ticketSequence += 1;
    const sequence = String(this.ticketSequence).padStart(3, '0');
    const ticket: Ticket = {
      id: `ticket-mock-${sequence}`,
      locationId: request.locationId,
      sessionId: request.sessionId,
      ticketNumber: `STAFF-${sequence}`,
      serviceId: request.serviceId,
      status: 'WAITING',
      source: 'STAFF',
      priorityLevel: request.priorityLevel ?? 0,
      issuedAt: now(),
      ...(request.counterId === undefined ? {} : { counterId: request.counterId }),
    };
    this.tickets.push(ticket);
    return ticket;
  }

  getQueueSummary(locationId: string): QueueSummary {
    const locationTickets = this.tickets.filter((ticket) => ticket.locationId === locationId);
    return {
      locationId,
      waitingCount: locationTickets.filter((ticket) => ticket.status === 'WAITING').length,
      calledCount: locationTickets.filter((ticket) => ticket.status === 'CALLED').length,
      servingCount: locationTickets.filter((ticket) => ticket.status === 'SERVING').length,
      skippedCount: locationTickets.filter((ticket) => ticket.status === 'SKIPPED').length,
      updatedAt: now(),
    };
  }

  private requireTicket(ticketId: string, locationId: string): Ticket {
    const ticket = this.tickets.find(
      (candidate) => candidate.id === ticketId && candidate.locationId === locationId,
    );
    if (ticket === undefined) {
      throw new MockStateError(404, 'TICKET_NOT_FOUND', 'The ticket was not found.');
    }
    return ticket;
  }

  private requireSession(sessionId: string, locationId: string): CounterSession {
    const session = this.sessions.find(
      (candidate) => candidate.id === sessionId && candidate.locationId === locationId,
    );
    if (session === undefined) {
      throw new MockStateError(404, 'SESSION_NOT_FOUND', 'The counter session was not found.');
    }
    return session;
  }

  private replaceTicket(ticket: Ticket): void {
    this.tickets = this.tickets.map((current) => (current.id === ticket.id ? ticket : current));
  }

  private replaceSession(session: CounterSession): void {
    this.sessions = this.sessions.map((current) => (current.id === session.id ? session : current));
  }
}
