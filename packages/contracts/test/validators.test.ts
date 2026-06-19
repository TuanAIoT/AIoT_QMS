import {
  isAudioPlayEvent,
  isDisplayUpdateEvent,
  isMqttEventEnvelope,
  isQueueCallEvent,
  isSurveyConfig,
  isTicketStatus,
  MQTT_EVENT_TYPES,
} from '@qms/contracts';
import { describe, expect, it } from 'vitest';

const validQueueCallEvent = {
  eventId: 'event-call-001',
  eventType: 'QUEUE_CALL',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:00.000Z',
  payload: {
    ticketId: 'ticket-001',
    ticketNumber: 'A-001',
    counterId: 'counter-001',
    counterName: 'Quầy Demo 01',
  },
};

const validDisplayUpdateEvent = {
  eventId: 'event-display-001',
  eventType: 'DISPLAY_UPDATE',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:01.000Z',
  payload: {
    state: {
      locationId: 'location-demo',
      currentTicket: null,
      waitingTickets: [],
      updatedAt: '2026-06-18T10:00:01.000Z',
    },
  },
};

const validAudioPlayEvent = {
  eventId: 'event-audio-001',
  eventType: 'AUDIO_PLAY',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:02.000Z',
  payload: {
    ticketNumber: 'A-001',
    counterName: 'Quầy Demo 01',
    outputMode: 'SERVER_SPEAKER',
    announcementText: 'Mời số A-001 đến Quầy Demo 01',
  },
};

describe('isMqttEventEnvelope', () => {
  it('accepts a valid known event envelope', () => {
    expect(isMqttEventEnvelope(validQueueCallEvent)).toBe(true);
    expect(MQTT_EVENT_TYPES).toContain('QUEUE_CALL');
  });

  it.each([null, undefined, 42, 'event', []])('rejects non-object value %p', (value) => {
    expect(isMqttEventEnvelope(value)).toBe(false);
  });

  it('rejects missing or empty envelope fields', () => {
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, eventId: '' })).toBe(false);
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, locationId: '' })).toBe(false);
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, timestamp: 'not-a-timestamp' })).toBe(
      false,
    );
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, eventType: 'UNKNOWN_EVENT' })).toBe(false);
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, payload: undefined })).toBe(false);
  });
});

describe('isQueueCallEvent', () => {
  it('accepts a complete queue call event', () => {
    expect(isQueueCallEvent(validQueueCallEvent)).toBe(true);
  });

  it('rejects a missing queue call payload field', () => {
    const invalidEvent = {
      ...validQueueCallEvent,
      payload: {
        ticketId: 'ticket-001',
        ticketNumber: 'A-001',
        counterId: 'counter-001',
      },
    };

    expect(isQueueCallEvent(invalidEvent)).toBe(false);
  });
});

describe('isDisplayUpdateEvent', () => {
  it('accepts a complete display update event', () => {
    expect(isDisplayUpdateEvent(validDisplayUpdateEvent)).toBe(true);
  });

  it('rejects an incomplete display state', () => {
    const invalidEvent = {
      ...validDisplayUpdateEvent,
      payload: { state: { locationId: 'location-demo' } },
    };

    expect(isDisplayUpdateEvent(invalidEvent)).toBe(false);
  });

  it('rejects sensitive citizen fields anywhere in the display payload', () => {
    const invalidEvent = {
      ...validDisplayUpdateEvent,
      payload: {
        ...validDisplayUpdateEvent.payload,
        citizenHash: 'synthetic-value',
      },
    };

    expect(isDisplayUpdateEvent(invalidEvent)).toBe(false);
  });
});

describe('isAudioPlayEvent', () => {
  it('accepts both supported audio output modes', () => {
    expect(isAudioPlayEvent(validAudioPlayEvent)).toBe(true);
    expect(
      isAudioPlayEvent({
        ...validAudioPlayEvent,
        payload: { ...validAudioPlayEvent.payload, outputMode: 'KIOSK_SPEAKER' },
      }),
    ).toBe(true);
  });

  it('rejects an invalid audio output mode or missing payload field', () => {
    expect(
      isAudioPlayEvent({
        ...validAudioPlayEvent,
        payload: { ...validAudioPlayEvent.payload, outputMode: 'BOTH_SPEAKERS' },
      }),
    ).toBe(false);
    expect(
      isAudioPlayEvent({
        ...validAudioPlayEvent,
        payload: {
          ticketNumber: 'A-001',
          counterName: 'Quầy Demo 01',
          outputMode: 'SERVER_SPEAKER',
        },
      }),
    ).toBe(false);
  });

  it('rejects sensitive citizen fields in the audio payload', () => {
    expect(
      isAudioPlayEvent({
        ...validAudioPlayEvent,
        payload: { ...validAudioPlayEvent.payload, cccd: 'prohibited-value' },
      }),
    ).toBe(false);
  });
});

describe('isTicketStatus', () => {
  it('accepts a documented status and rejects an unknown status', () => {
    expect(isTicketStatus('WAITING')).toBe(true);
    expect(isTicketStatus('UNKNOWN')).toBe(false);
    expect(isTicketStatus(null)).toBe(false);
  });
});

describe('isSurveyConfig', () => {
  it('accepts only a positive integer timeout', () => {
    expect(isSurveyConfig({ surveyTimeoutSeconds: 20 })).toBe(true);
  });

  it.each([
    null,
    {},
    { surveyTimeoutSeconds: 0 },
    { surveyTimeoutSeconds: -1 },
    { surveyTimeoutSeconds: 1.5 },
    { surveyTimeoutSeconds: '20' },
    { surveyTimeoutSeconds: 20, extra: true },
  ])('rejects invalid survey config %p', (value) => {
    expect(isSurveyConfig(value)).toBe(false);
  });
});
