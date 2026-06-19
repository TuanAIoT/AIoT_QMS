import {
  isAudioPlayEvent,
  isMqttEventEnvelope,
  type AudioPlayEvent,
  type EventId,
  type ISODateTimeString,
} from '@qms/contracts';

export const SERVICE_NAME = 'Linux_Audio_Service';

const FALLBACK_AUDIO_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'ticketNumber',
  'counterName',
  'outputMode',
]);
const MAX_ANNOUNCEMENT_LENGTH = 200;
const SENSITIVE_ANNOUNCEMENT_PATTERNS: readonly RegExp[] = [
  /cccd|cmnd|căn\s*cước|citizen\s*id|identity\s*number/iu,
  /họ\s*(?:và\s*)?tên|tên\s*công\s*dân|customer\s*name/iu,
  /số\s*điện\s*thoại|điện\s*thoại|phone|email|địa\s*chỉ|address/iu,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
  /(?:\+?84|0)\d{9,10}/u,
  /\b(?:\d{9}|\d{12})\b/u,
];

export interface AudioHistoryEntry {
  readonly eventId: EventId;
  readonly announcement: string;
  readonly timestamp: ISODateTimeString;
}

export type AudioProcessResult =
  | {
      readonly status: 'PROCESSED';
      readonly announcement: string;
      readonly entry: AudioHistoryEntry;
    }
  | { readonly status: 'INVALID_EVENT' }
  | { readonly status: 'DUPLICATE_EVENT' };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function buildFallbackAnnouncement(ticketNumber: string, counterName: string): string {
  const spokenTicketNumber = ticketNumber.replace(/[\s-]+/g, '');
  const spokenCounterName = counterName.replace(/^quầy\s+/i, 'quầy ');
  return `Mời số ${spokenTicketNumber} đến ${spokenCounterName}`;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
      return true;
    }
  }
  return false;
}

function sanitizeAnnouncement(value: string): string | undefined {
  if (
    value.length > MAX_ANNOUNCEMENT_LENGTH ||
    containsControlCharacter(value) ||
    SENSITIVE_ANNOUNCEMENT_PATTERNS.some((pattern) => pattern.test(value))
  ) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeDryRunEvent(value: unknown): AudioPlayEvent | undefined {
  if (isAudioPlayEvent(value)) {
    return value;
  }

  if (
    !isMqttEventEnvelope(value) ||
    value.eventType !== 'AUDIO_PLAY' ||
    !hasOnlyKeys(value.payload, FALLBACK_AUDIO_PAYLOAD_KEYS) ||
    !isNonEmptyString(value.payload.ticketNumber) ||
    !isNonEmptyString(value.payload.counterName) ||
    (value.payload.outputMode !== 'SERVER_SPEAKER' && value.payload.outputMode !== 'KIOSK_SPEAKER')
  ) {
    return undefined;
  }

  // BACKEND_CONFIRMATION_REQUIRED: AudioPlayEvent currently requires announcementText.
  // Dry-run alone may derive it from the two non-sensitive display fields before revalidation.
  const normalized: unknown = {
    eventId: value.eventId,
    eventType: value.eventType,
    locationId: value.locationId,
    timestamp: value.timestamp,
    payload: {
      ticketNumber: value.payload.ticketNumber,
      counterName: value.payload.counterName,
      outputMode: value.payload.outputMode,
      announcementText: buildFallbackAnnouncement(
        value.payload.ticketNumber,
        value.payload.counterName,
      ),
    },
  };

  return isAudioPlayEvent(normalized) ? normalized : undefined;
}

export class AudioDryRunProcessor {
  private readonly processedEventIds = new Set<EventId>();
  private readonly entries: AudioHistoryEntry[] = [];

  process(value: unknown): AudioProcessResult {
    const event = normalizeDryRunEvent(value);
    if (event === undefined) {
      return { status: 'INVALID_EVENT' };
    }
    if (this.processedEventIds.has(event.eventId)) {
      return { status: 'DUPLICATE_EVENT' };
    }

    const announcement = sanitizeAnnouncement(event.payload.announcementText);
    if (announcement === undefined) {
      return { status: 'INVALID_EVENT' };
    }
    const entry: AudioHistoryEntry = {
      eventId: event.eventId,
      announcement,
      timestamp: event.timestamp,
    };
    this.entries.push(entry);
    this.processedEventIds.add(event.eventId);

    return { status: 'PROCESSED', announcement, entry };
  }

  get history(): readonly AudioHistoryEntry[] {
    return [...this.entries];
  }
}

export function getStartupMessage(): string {
  return `${SERVICE_NAME} dry-run mode`;
}
