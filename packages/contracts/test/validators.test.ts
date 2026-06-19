import {
  isAudioPlayEvent,
  isDeviceHeartbeatEvent,
  isDisplayUpdateEvent,
  isMqttEventEnvelope,
  isQueueCallEvent,
  isQueueFinishEvent,
  isQueueRecallEvent,
  isQueueTransferEvent,
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

const validTicket = {
  id: 'ticket-001',
  locationId: 'location-demo',
  sessionId: 'session-demo',
  ticketNumber: 'A-001',
  serviceId: 'service-demo',
  counterId: 'counter-001',
  servicePoolId: 'pool-demo',
  status: 'WAITING',
  source: 'KIOSK',
  priorityLevel: 0,
  issuedAt: '2026-06-18T09:55:00.000Z',
  calledAt: '2026-06-18T09:56:00.000Z',
  servingAt: '2026-06-18T09:57:00.000Z',
  finishedAt: '2026-06-18T09:58:00.000Z',
  nextServiceId: 'service-demo-next',
  estimatedWaitSeconds: 120,
};

const validDisplayUpdateEvent = {
  eventId: 'event-display-001',
  eventType: 'DISPLAY_UPDATE',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:01.000Z',
  payload: {
    state: {
      locationId: 'location-demo',
      currentTicket: validTicket,
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

const validQueueRecallEvent = {
  ...validQueueCallEvent,
  eventId: 'event-recall-001',
  eventType: 'QUEUE_RECALL',
};

const validQueueTransferEvent = {
  eventId: 'event-transfer-001',
  eventType: 'QUEUE_TRANSFER',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:03.000Z',
  payload: {
    ticketId: 'ticket-001',
    ticketNumber: 'A-001',
    fromCounterId: 'counter-001',
    toCounterId: 'counter-002',
  },
};

const validQueueFinishEvent = {
  eventId: 'event-finish-001',
  eventType: 'QUEUE_FINISH',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:04.000Z',
  payload: {
    ticketId: 'ticket-001',
    ticketNumber: 'A-001',
    counterId: 'counter-001',
  },
};

const validDeviceHeartbeatEvent = {
  eventId: 'event-heartbeat-001',
  eventType: 'DEVICE_HEARTBEAT',
  locationId: 'location-demo',
  timestamp: '2026-06-18T10:00:05.000Z',
  payload: {
    deviceId: 'device-001',
    status: 'ONLINE',
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

  it('rejects an envelope with eventId omitted entirely', () => {
    expect(
      isMqttEventEnvelope({
        eventType: validQueueCallEvent.eventType,
        locationId: validQueueCallEvent.locationId,
        timestamp: validQueueCallEvent.timestamp,
        payload: validQueueCallEvent.payload,
      }),
    ).toBe(false);
  });

  it('rejects an envelope with locationId omitted entirely', () => {
    expect(
      isMqttEventEnvelope({
        eventId: validQueueCallEvent.eventId,
        eventType: validQueueCallEvent.eventType,
        timestamp: validQueueCallEvent.timestamp,
        payload: validQueueCallEvent.payload,
      }),
    ).toBe(false);
  });

  it('accepts a canonical UTC timestamp', () => {
    expect(isMqttEventEnvelope(validQueueCallEvent)).toBe(true);
  });

  it('rejects an impossible calendar date', () => {
    expect(
      isMqttEventEnvelope({
        ...validQueueCallEvent,
        timestamp: '2026-02-30T10:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('rejects a missing or non-string timestamp', () => {
    expect(
      isMqttEventEnvelope({
        eventId: validQueueCallEvent.eventId,
        eventType: validQueueCallEvent.eventType,
        locationId: validQueueCallEvent.locationId,
        payload: validQueueCallEvent.payload,
      }),
    ).toBe(false);
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, timestamp: 123 })).toBe(false);
  });

  it.each([
    'customerName',
    'fullName',
    'phone',
    'email',
    'address',
    'citizenHash',
    'cccd',
    'cccdNumber',
    'citizenIdNumber',
    'identityNumber',
  ])('rejects unexpected envelope field %s', (field) => {
    expect(isMqttEventEnvelope({ ...validQueueCallEvent, [field]: 'prohibited-value' })).toBe(
      false,
    );
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

  it.each([
    'customerName',
    'fullName',
    'phone',
    'email',
    'address',
    'citizenHash',
    'cccd',
    'cccdNumber',
    'citizenIdNumber',
    'identityNumber',
  ])('rejects unexpected display payload field %s', (field) => {
    expect(
      isDisplayUpdateEvent({
        ...validDisplayUpdateEvent,
        payload: { ...validDisplayUpdateEvent.payload, [field]: 'prohibited-value' },
      }),
    ).toBe(false);
  });

  it.each(['customerName', 'citizenHash'])('rejects display envelope PII field %s', (field) => {
    expect(isDisplayUpdateEvent({ ...validDisplayUpdateEvent, [field]: 'prohibited-value' })).toBe(
      false,
    );
  });

  it.each([
    ['counterId', 123],
    ['sessionId', 123],
    ['servicePoolId', 123],
    ['calledAt', 123],
    ['servingAt', 123],
    ['finishedAt', 123],
    ['nextServiceId', 123],
    ['estimatedWaitSeconds', '120'],
    ['cccdScanned', 'not-a-boolean'],
    ['faceVerified', 'not-a-boolean'],
    ['ewtSeconds', '120'],
  ])('rejects invalid or unknown Ticket optional field %s', (field, value) => {
    expect(
      isDisplayUpdateEvent({
        ...validDisplayUpdateEvent,
        payload: {
          state: {
            ...validDisplayUpdateEvent.payload.state,
            currentTicket: { ...validTicket, [field]: value },
          },
        },
      }),
    ).toBe(false);
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

  it.each([
    'customerName',
    'fullName',
    'phone',
    'email',
    'address',
    'citizenHash',
    'cccd',
    'cccdNumber',
    'citizenIdNumber',
    'identityNumber',
  ])('rejects unexpected audio payload field %s', (field) => {
    expect(
      isAudioPlayEvent({
        ...validAudioPlayEvent,
        payload: { ...validAudioPlayEvent.payload, [field]: 'prohibited-value' },
      }),
    ).toBe(false);
  });

  it.each(['cccd', 'email'])('rejects audio envelope PII field %s', (field) => {
    expect(isAudioPlayEvent({ ...validAudioPlayEvent, [field]: 'prohibited-value' })).toBe(false);
  });
});

describe('new MQTT event validators', () => {
  it('validates QueueRecallEvent schema and rejects missing or extra payload fields', () => {
    expect(isQueueRecallEvent(validQueueRecallEvent)).toBe(true);
    expect(
      isQueueRecallEvent({ ...validQueueRecallEvent, payload: { ticketId: 'ticket-001' } }),
    ).toBe(false);
    expect(
      isQueueRecallEvent({
        ...validQueueRecallEvent,
        payload: { ...validQueueRecallEvent.payload, extra: true },
      }),
    ).toBe(false);
  });

  it('validates QueueTransferEvent schema and rejects missing or extra payload fields', () => {
    expect(isQueueTransferEvent(validQueueTransferEvent)).toBe(true);
    expect(
      isQueueTransferEvent({
        ...validQueueTransferEvent,
        payload: { ticketId: 'ticket-001' },
      }),
    ).toBe(false);
    expect(
      isQueueTransferEvent({
        ...validQueueTransferEvent,
        payload: { ...validQueueTransferEvent.payload, extra: true },
      }),
    ).toBe(false);
  });

  it('validates QueueFinishEvent schema and rejects missing or extra payload fields', () => {
    expect(isQueueFinishEvent(validQueueFinishEvent)).toBe(true);
    expect(
      isQueueFinishEvent({ ...validQueueFinishEvent, payload: { ticketId: 'ticket-001' } }),
    ).toBe(false);
    expect(
      isQueueFinishEvent({
        ...validQueueFinishEvent,
        payload: { ...validQueueFinishEvent.payload, extra: true },
      }),
    ).toBe(false);
  });

  it('validates DeviceHeartbeatEvent schema and rejects invalid or extra payload fields', () => {
    expect(isDeviceHeartbeatEvent(validDeviceHeartbeatEvent)).toBe(true);
    expect(
      isDeviceHeartbeatEvent({
        ...validDeviceHeartbeatEvent,
        payload: { ...validDeviceHeartbeatEvent.payload, status: 'UNKNOWN' },
      }),
    ).toBe(false);
    expect(
      isDeviceHeartbeatEvent({
        ...validDeviceHeartbeatEvent,
        payload: { ...validDeviceHeartbeatEvent.payload, extra: true },
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
