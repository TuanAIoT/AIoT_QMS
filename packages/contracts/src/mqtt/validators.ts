import type { ISODateTimeString } from '../common.js';
import type { DisplayState, SurveyConfig, Ticket } from '../domain.js';
import {
  AUDIO_OUTPUT_MODES,
  TICKET_STATUSES,
  type AudioOutputMode,
  type TicketStatus,
} from '../statuses.js';
import {
  MQTT_EVENT_TYPES,
  type AudioPlayEvent,
  type DeviceHeartbeatEvent,
  type DisplayUpdateEvent,
  type MqttEventEnvelope,
  type MqttEventType,
  type QueueCallEvent,
  type QueueFinishEvent,
  type QueueRecallEvent,
  type QueueTransferEvent,
} from './events.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const AUDIO_PLAY_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'ticketNumber',
  'counterName',
  'outputMode',
  'announcementText',
]);

const DISPLAY_UPDATE_PAYLOAD_KEYS: ReadonlySet<string> = new Set(['state']);

const MQTT_ENVELOPE_KEYS: ReadonlySet<string> = new Set([
  'eventId',
  'eventType',
  'locationId',
  'timestamp',
  'payload',
]);

const QUEUE_CALL_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'ticketId',
  'ticketNumber',
  'counterId',
  'counterName',
]);

const QUEUE_TRANSFER_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'ticketId',
  'ticketNumber',
  'fromCounterId',
  'toCounterId',
]);

const QUEUE_FINISH_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'ticketId',
  'ticketNumber',
  'counterId',
]);

const DEVICE_HEARTBEAT_PAYLOAD_KEYS: ReadonlySet<string> = new Set(['deviceId', 'status']);

const DISPLAY_STATE_KEYS: ReadonlySet<string> = new Set([
  'locationId',
  'counterId',
  'currentTicket',
  'waitingTickets',
  'updatedAt',
]);

const TICKET_KEYS: ReadonlySet<string> = new Set([
  'id',
  'locationId',
  'sessionId',
  'ticketNumber',
  'serviceId',
  'counterId',
  'servicePoolId',
  'status',
  'source',
  'priorityLevel',
  'issuedAt',
  'calledAt',
  'servingAt',
  'finishedAt',
  'nextServiceId',
  'estimatedWaitSeconds',
]);

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isISODateTimeString(value: unknown): value is ISODateTimeString {
  // BACKEND_CONFIRMATION_REQUIRED: Offset timezone support is not confirmed.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isMqttEventType(value: unknown): value is MqttEventType {
  return MQTT_EVENT_TYPES.some((eventType) => eventType === value);
}

function isAudioOutputMode(value: unknown): value is AudioOutputMode {
  return AUDIO_OUTPUT_MODES.some((mode) => mode === value);
}

function isTicket(value: unknown): value is Ticket {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, TICKET_KEYS) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.locationId) &&
    (value.sessionId === undefined || isNonEmptyString(value.sessionId)) &&
    isNonEmptyString(value.ticketNumber) &&
    isNonEmptyString(value.serviceId) &&
    (value.counterId === undefined || isNonEmptyString(value.counterId)) &&
    (value.servicePoolId === undefined || isNonEmptyString(value.servicePoolId)) &&
    isTicketStatus(value.status) &&
    isTicketSource(value.source) &&
    isPriorityLevel(value.priorityLevel) &&
    isISODateTimeString(value.issuedAt) &&
    (value.calledAt === undefined || isISODateTimeString(value.calledAt)) &&
    (value.servingAt === undefined || isISODateTimeString(value.servingAt)) &&
    (value.finishedAt === undefined || isISODateTimeString(value.finishedAt)) &&
    (value.nextServiceId === undefined || isNonEmptyString(value.nextServiceId)) &&
    (value.estimatedWaitSeconds === undefined ||
      (typeof value.estimatedWaitSeconds === 'number' &&
        Number.isFinite(value.estimatedWaitSeconds) &&
        value.estimatedWaitSeconds >= 0))
  );
}

function isTicketSource(value: unknown): boolean {
  return value === 'KIOSK' || value === 'ZALO' || value === 'STAFF';
}

function isPriorityLevel(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}

function isDisplayState(value: unknown): value is DisplayState {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, DISPLAY_STATE_KEYS) &&
    isNonEmptyString(value.locationId) &&
    (value.counterId === undefined || isNonEmptyString(value.counterId)) &&
    (value.currentTicket === null || isTicket(value.currentTicket)) &&
    Array.isArray(value.waitingTickets) &&
    value.waitingTickets.every(isTicket) &&
    isISODateTimeString(value.updatedAt)
  );
}

export function isMqttEventEnvelope(
  value: unknown,
): value is MqttEventEnvelope<MqttEventType, Record<string, unknown>> {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, MQTT_ENVELOPE_KEYS) &&
    isNonEmptyString(value.eventId) &&
    isMqttEventType(value.eventType) &&
    isNonEmptyString(value.locationId) &&
    isISODateTimeString(value.timestamp) &&
    isRecord(value.payload)
  );
}

export function isQueueCallEvent(value: unknown): value is QueueCallEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'QUEUE_CALL') {
    return false;
  }

  return (
    hasOnlyKeys(value.payload, QUEUE_CALL_PAYLOAD_KEYS) &&
    isNonEmptyString(value.payload.ticketId) &&
    isNonEmptyString(value.payload.ticketNumber) &&
    isNonEmptyString(value.payload.counterId) &&
    isNonEmptyString(value.payload.counterName)
  );
}

export function isQueueRecallEvent(value: unknown): value is QueueRecallEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'QUEUE_RECALL') {
    return false;
  }

  return (
    hasOnlyKeys(value.payload, QUEUE_CALL_PAYLOAD_KEYS) &&
    isNonEmptyString(value.payload.ticketId) &&
    isNonEmptyString(value.payload.ticketNumber) &&
    isNonEmptyString(value.payload.counterId) &&
    isNonEmptyString(value.payload.counterName)
  );
}

export function isQueueTransferEvent(value: unknown): value is QueueTransferEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'QUEUE_TRANSFER') {
    return false;
  }

  return (
    hasOnlyKeys(value.payload, QUEUE_TRANSFER_PAYLOAD_KEYS) &&
    isNonEmptyString(value.payload.ticketId) &&
    isNonEmptyString(value.payload.ticketNumber) &&
    isNonEmptyString(value.payload.fromCounterId) &&
    isNonEmptyString(value.payload.toCounterId)
  );
}

export function isQueueFinishEvent(value: unknown): value is QueueFinishEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'QUEUE_FINISH') {
    return false;
  }

  return (
    hasOnlyKeys(value.payload, QUEUE_FINISH_PAYLOAD_KEYS) &&
    isNonEmptyString(value.payload.ticketId) &&
    isNonEmptyString(value.payload.ticketNumber) &&
    isNonEmptyString(value.payload.counterId)
  );
}

export function isDeviceHeartbeatEvent(value: unknown): value is DeviceHeartbeatEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'DEVICE_HEARTBEAT') {
    return false;
  }

  return (
    hasOnlyKeys(value.payload, DEVICE_HEARTBEAT_PAYLOAD_KEYS) &&
    isNonEmptyString(value.payload.deviceId) &&
    (value.payload.status === 'ONLINE' || value.payload.status === 'OFFLINE')
  );
}

export function isDisplayUpdateEvent(value: unknown): value is DisplayUpdateEvent {
  return (
    isMqttEventEnvelope(value) &&
    value.eventType === 'DISPLAY_UPDATE' &&
    hasOnlyKeys(value.payload, DISPLAY_UPDATE_PAYLOAD_KEYS) &&
    isDisplayState(value.payload.state)
  );
}

export function isAudioPlayEvent(value: unknown): value is AudioPlayEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'AUDIO_PLAY') {
    return false;
  }

  return (
    hasOnlyKeys(value.payload, AUDIO_PLAY_PAYLOAD_KEYS) &&
    isNonEmptyString(value.payload.ticketNumber) &&
    isNonEmptyString(value.payload.counterName) &&
    isAudioOutputMode(value.payload.outputMode) &&
    isNonEmptyString(value.payload.announcementText)
  );
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return TICKET_STATUSES.some((status) => status === value);
}

export function isSurveyConfig(value: unknown): value is SurveyConfig {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value.surveyTimeoutSeconds === 'number' &&
    Number.isInteger(value.surveyTimeoutSeconds) &&
    value.surveyTimeoutSeconds > 0
  );
}
