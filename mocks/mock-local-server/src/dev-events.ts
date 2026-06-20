import type {
  AudioPlayEvent,
  Counter,
  DisplayUpdateEvent,
  QueueCallEvent,
  QueueFinishEvent,
  QueueRecallEvent,
  QueueTransferEvent,
  Ticket,
} from '@qms/contracts';
import {
  MqttSimulator,
  type SimulatorEvent,
  type SimulatorPublishResult,
  type SimulatorTopic,
} from '@qms/mqtt-simulator';

import type { MockLocalState } from './state.js';

/** BACKEND_CONFIRMATION_REQUIRED: DRAFT development topics mirror MQTT_CONTRACT.md. */
export const DEV_EVENT_TOPICS = {
  queueCall: 'hcc/queue/call',
  queueRecall: 'hcc/queue/recall',
  queueTransfer: 'hcc/queue/transfer',
  queueFinish: 'hcc/queue/finish',
  displayUpdate: 'hcc/display/update',
  audioPlay: 'hcc/audio/play',
} as const satisfies Readonly<Record<string, SimulatorTopic>>;

const SUBSCRIBED_DEV_TOPICS = [
  DEV_EVENT_TOPICS.queueCall,
  DEV_EVENT_TOPICS.queueRecall,
  DEV_EVENT_TOPICS.queueTransfer,
  DEV_EVENT_TOPICS.queueFinish,
  DEV_EVENT_TOPICS.displayUpdate,
  DEV_EVENT_TOPICS.audioPlay,
] as const satisfies readonly SimulatorTopic[];

const SAFE_TICKET_NUMBER = /^[A-Z0-9-]{1,24}$/i;
const SENSITIVE_TEXT =
  /cccd|cmnd|căn\s*cước|citizen\s*id|identity\s*number|phone|email|address|địa\s*chỉ|(?:\+?84|0)\d{9,10}|\b(?:\d{9}|\d{12})\b/iu;

export interface DevEventLogEntry {
  readonly sequence: number;
  readonly topic: SimulatorTopic;
  readonly event: SimulatorEvent;
  readonly createdAt: string;
}

export interface DevEventsResponse {
  readonly events: readonly DevEventLogEntry[];
  readonly lastSequence: number;
}

function assertSafePublicFields(ticketNumber: string, counterName: string): void {
  if (
    !SAFE_TICKET_NUMBER.test(ticketNumber) ||
    counterName.trim().length === 0 ||
    counterName.length > 80 ||
    SENSITIVE_TEXT.test(ticketNumber) ||
    SENSITIVE_TEXT.test(counterName)
  ) {
    throw new Error('Unsafe development event display fields were rejected.');
  }
}

function buildAnnouncement(ticketNumber: string, counterName: string, recall: boolean): string {
  assertSafePublicFields(ticketNumber, counterName);
  const spokenTicketNumber = ticketNumber.replace(/[\s-]+/g, '');
  const spokenCounterName = counterName.replace(/^quầy\s+/i, 'quầy ');
  return `Mời số ${spokenTicketNumber} đến ${spokenCounterName}${recall ? ', gọi lại' : ''}`;
}

function toSafeDisplayTicket(ticket: Ticket): Ticket {
  return {
    id: ticket.id,
    locationId: ticket.locationId,
    ticketNumber: ticket.ticketNumber,
    serviceId: ticket.serviceId,
    status: ticket.status,
    source: ticket.source,
    priorityLevel: ticket.priorityLevel,
    issuedAt: ticket.issuedAt,
    ...(ticket.counterId === undefined ? {} : { counterId: ticket.counterId }),
  };
}

export class DevEventPipeline {
  private readonly simulator = new MqttSimulator();
  private readonly entries: DevEventLogEntry[] = [];
  private eventSequence = 0;
  private logSequence = 0;

  constructor(private readonly state: MockLocalState) {
    this.subscribeToValidatedEvents();
  }

  publish(topic: SimulatorTopic, event: unknown): SimulatorPublishResult {
    return this.simulator.publish(topic, event);
  }

  recordCall(ticket: Ticket, counter: Counter): void {
    const timestamp = new Date().toISOString();
    assertSafePublicFields(ticket.ticketNumber, counter.name);
    const callEvent: QueueCallEvent = {
      ...this.envelope('QUEUE_CALL', ticket.locationId, timestamp),
      payload: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        counterId: counter.id,
        counterName: counter.name,
      },
    };
    this.publish(DEV_EVENT_TOPICS.queueCall, callEvent);
    this.recordDisplayUpdate(ticket.locationId, counter.id, ticket, timestamp);
    this.recordAudio(ticket, counter, timestamp, false);
  }

  recordRecall(ticket: Ticket, counter: Counter): void {
    const timestamp = new Date().toISOString();
    assertSafePublicFields(ticket.ticketNumber, counter.name);
    const recallEvent: QueueRecallEvent = {
      ...this.envelope('QUEUE_RECALL', ticket.locationId, timestamp),
      payload: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        counterId: counter.id,
        counterName: counter.name,
      },
    };
    this.publish(DEV_EVENT_TOPICS.queueRecall, recallEvent);
    this.recordAudio(ticket, counter, timestamp, true);
  }

  recordTransfer(ticket: Ticket, fromCounterId: string, toCounter: Counter): void {
    const timestamp = new Date().toISOString();
    assertSafePublicFields(ticket.ticketNumber, toCounter.name);
    const transferEvent: QueueTransferEvent = {
      ...this.envelope('QUEUE_TRANSFER', ticket.locationId, timestamp),
      payload: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        fromCounterId,
        toCounterId: toCounter.id,
      },
    };
    this.publish(DEV_EVENT_TOPICS.queueTransfer, transferEvent);
    this.recordDisplayUpdate(ticket.locationId, toCounter.id, ticket, timestamp);
  }

  recordFinish(ticket: Ticket, counter: Counter): void {
    const timestamp = new Date().toISOString();
    assertSafePublicFields(ticket.ticketNumber, counter.name);
    const finishEvent: QueueFinishEvent = {
      ...this.envelope('QUEUE_FINISH', ticket.locationId, timestamp),
      payload: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        counterId: counter.id,
      },
    };
    this.publish(DEV_EVENT_TOPICS.queueFinish, finishEvent);
    this.recordDisplayUpdate(ticket.locationId, counter.id, null, timestamp);
  }

  snapshot(afterSequence = 0): DevEventsResponse {
    return {
      events: this.entries.filter((entry) => entry.sequence > afterSequence),
      lastSequence: this.logSequence,
    };
  }

  reset(): void {
    this.simulator.reset();
    this.entries.length = 0;
    this.eventSequence = 0;
    this.logSequence = 0;
    this.subscribeToValidatedEvents();
  }

  private recordAudio(ticket: Ticket, counter: Counter, timestamp: string, recall: boolean): void {
    const announcementText = buildAnnouncement(ticket.ticketNumber, counter.name, recall);
    const audioEvent: AudioPlayEvent = {
      ...this.envelope('AUDIO_PLAY', ticket.locationId, timestamp),
      payload: {
        ticketNumber: ticket.ticketNumber,
        counterName: counter.name,
        outputMode: 'SERVER_SPEAKER',
        announcementText,
      },
    };
    this.publish(DEV_EVENT_TOPICS.audioPlay, audioEvent);
  }

  private recordDisplayUpdate(
    locationId: string,
    counterId: string,
    currentTicket: Ticket | null,
    timestamp: string,
  ): void {
    const displayEvent: DisplayUpdateEvent = {
      ...this.envelope('DISPLAY_UPDATE', locationId, timestamp),
      payload: {
        state: {
          locationId,
          counterId,
          currentTicket: currentTicket === null ? null : toSafeDisplayTicket(currentTicket),
          waitingTickets: this.state.getWaitingTickets(locationId).map(toSafeDisplayTicket),
          updatedAt: timestamp,
        },
      },
    };
    this.publish(DEV_EVENT_TOPICS.displayUpdate, displayEvent);
  }

  private envelope<TEventType extends SimulatorEvent['eventType']>(
    eventType: TEventType,
    locationId: string,
    timestamp: string,
  ): {
    readonly eventId: string;
    readonly eventType: TEventType;
    readonly locationId: string;
    readonly timestamp: string;
  } {
    this.eventSequence += 1;
    return {
      eventId: `mock-local-event-${String(this.eventSequence)}`,
      eventType,
      locationId,
      timestamp,
    };
  }

  private subscribeToValidatedEvents(): void {
    for (const topic of SUBSCRIBED_DEV_TOPICS) {
      this.simulator.subscribe(topic, (event) => {
        this.logSequence += 1;
        this.entries.push({
          sequence: this.logSequence,
          topic,
          event,
          createdAt: new Date().toISOString(),
        });
      });
    }
  }
}
