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
  type DisplayUpdateEvent,
  type MqttEventEnvelope,
  type MqttEventType,
  type QueueCallEvent,
} from './events.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const FORBIDDEN_IDENTITY_KEYS = new Set([
  'cccd',
  'cccdnumber',
  'citizenidnumber',
  'identitynumber',
  'citizenhash',
]);

function containsForbiddenIdentityKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenIdentityKey);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase()) ||
      containsForbiddenIdentityKey(nestedValue),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isISODateTimeString(value: unknown): value is ISODateTimeString {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
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
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.locationId) &&
    isNonEmptyString(value.ticketNumber) &&
    isNonEmptyString(value.serviceId) &&
    isTicketStatus(value.status) &&
    isTicketSource(value.source) &&
    isPriorityLevel(value.priorityLevel) &&
    isISODateTimeString(value.issuedAt)
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
    isNonEmptyString(value.payload.ticketId) &&
    isNonEmptyString(value.payload.ticketNumber) &&
    isNonEmptyString(value.payload.counterId) &&
    isNonEmptyString(value.payload.counterName)
  );
}

export function isDisplayUpdateEvent(value: unknown): value is DisplayUpdateEvent {
  return (
    isMqttEventEnvelope(value) &&
    value.eventType === 'DISPLAY_UPDATE' &&
    !containsForbiddenIdentityKey(value.payload) &&
    isDisplayState(value.payload.state)
  );
}

export function isAudioPlayEvent(value: unknown): value is AudioPlayEvent {
  if (!isMqttEventEnvelope(value) || value.eventType !== 'AUDIO_PLAY') {
    return false;
  }

  return (
    !containsForbiddenIdentityKey(value.payload) &&
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
