import type {
  CounterId,
  DeviceId,
  EventId,
  ISODateTimeString,
  LocationId,
  TicketId,
} from '../common.js';
import type { AudioCommand, DisplayState } from '../domain.js';
import type { DeviceStatus } from '../statuses.js';

export interface MqttEventEnvelope<TEventType extends string, TPayload> {
  readonly eventId: EventId;
  readonly eventType: TEventType;
  readonly locationId: LocationId;
  readonly timestamp: ISODateTimeString;
  readonly payload: TPayload;
}

/** BACKEND_CONFIRMATION_REQUIRED: Event type values are not confirmed MQTT payload contracts. */
export const MQTT_EVENT_TYPES = [
  'QUEUE_CALL',
  'QUEUE_RECALL',
  'QUEUE_TRANSFER',
  'QUEUE_FINISH',
  'DISPLAY_UPDATE',
  'AUDIO_PLAY',
  'DEVICE_HEARTBEAT',
] as const;
export type MqttEventType = (typeof MQTT_EVENT_TYPES)[number];

export interface QueueCallPayload {
  /** BACKEND_CONFIRMATION_REQUIRED: Called ticket identifier field is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Called ticket display value is not confirmed. */
  readonly ticketNumber: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Called counter identifier field is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Called counter display value is not confirmed. */
  readonly counterName: string;
}

export type QueueCallEvent = MqttEventEnvelope<'QUEUE_CALL', QueueCallPayload>;

export interface QueueRecallPayload {
  /** BACKEND_CONFIRMATION_REQUIRED: Recalled ticket identifier field is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Recalled ticket display value is not confirmed. */
  readonly ticketNumber: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Recalled counter identifier field is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Recalled counter display value is not confirmed. */
  readonly counterName: string;
}

export type QueueRecallEvent = MqttEventEnvelope<'QUEUE_RECALL', QueueRecallPayload>;

export interface QueueTransferPayload {
  /** BACKEND_CONFIRMATION_REQUIRED: Transferred ticket identifier field is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Transferred ticket display value is not confirmed. */
  readonly ticketNumber: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Source counter field is not confirmed. */
  readonly fromCounterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Destination counter field is not confirmed. */
  readonly toCounterId: CounterId;
}

export type QueueTransferEvent = MqttEventEnvelope<'QUEUE_TRANSFER', QueueTransferPayload>;

export interface QueueFinishPayload {
  /** BACKEND_CONFIRMATION_REQUIRED: Finished ticket identifier field is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Finished ticket display value is not confirmed. */
  readonly ticketNumber: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Finishing counter field is not confirmed. */
  readonly counterId: CounterId;
}

export type QueueFinishEvent = MqttEventEnvelope<'QUEUE_FINISH', QueueFinishPayload>;

export interface DisplayUpdatePayload {
  /** BACKEND_CONFIRMATION_REQUIRED: Display state projection is not confirmed. */
  readonly state: DisplayState;
}

export type DisplayUpdateEvent = MqttEventEnvelope<'DISPLAY_UPDATE', DisplayUpdatePayload>;

export type AudioPlayEvent = MqttEventEnvelope<'AUDIO_PLAY', AudioCommand>;

export interface DeviceHeartbeatPayload {
  /** BACKEND_CONFIRMATION_REQUIRED: Heartbeat device identifier field is not confirmed. */
  readonly deviceId: DeviceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Heartbeat device status field is not confirmed. */
  readonly status: DeviceStatus;
}

export type DeviceHeartbeatEvent = MqttEventEnvelope<
  'DEVICE_HEARTBEAT',
  DeviceHeartbeatPayload
>;

export type CounterEvent =
  | QueueCallEvent
  | QueueRecallEvent
  | QueueTransferEvent
  | QueueFinishEvent;
