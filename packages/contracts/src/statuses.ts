/** BACKEND_CONFIRMATION_REQUIRED: Ticket status values are transcribed from DRAFT source material. */
export const TICKET_STATUSES = [
  'WAITING',
  'CALLED',
  'SERVING',
  'SKIPPED',
  'TRANSFERRED',
  'FINISHED',
  'CANCELLED',
  'ROLLOVER',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Ticket source values are not confirmed by Backend. */
export const TICKET_SOURCES = ['KIOSK', 'ZALO', 'STAFF'] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Priority levels and their meanings are not confirmed. */
export const PRIORITY_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Device type values are transcribed from DRAFT source material. */
export const DEVICE_TYPES = ['KIOSK', 'TELLER', 'TABLET', 'DISPLAY_BOX', 'LED'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Device status values and heartbeat thresholds are not confirmed. */
export const DEVICE_STATUSES = ['ONLINE', 'OFFLINE'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Audio routing values are not confirmed by Backend. */
export const AUDIO_OUTPUT_MODES = ['SERVER_SPEAKER', 'KIOSK_SPEAKER'] as const;
export type AudioOutputMode = (typeof AUDIO_OUTPUT_MODES)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Counter state transitions are not confirmed. */
export const COUNTER_STATUSES = ['OPEN', 'CLOSED'] as const;
export type CounterStatus = (typeof COUNTER_STATUSES)[number];

/** BACKEND_CONFIRMATION_REQUIRED: Session state transitions are not confirmed. */
export const SESSION_STATUSES = ['ACTIVE', 'ENDED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const CONTRACT_STATUSES = [
  'CONFIRMED',
  'PROVISIONAL',
  'BACKEND_CONFIRMATION_REQUIRED',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
