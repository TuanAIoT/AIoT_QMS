import type { AudioPlayEvent, DisplayUpdateEvent, QueueCallEvent } from '@qms/contracts';
import { isAudioPlayEvent, isDisplayUpdateEvent, isQueueCallEvent } from '@qms/contracts';
import { describe, expect, it, vi } from 'vitest';

import { MQTT_TOPICS, MqttClient } from '../src/index.js';

const LOCATION_ID = 'location-demo';
const TIMESTAMP = '2026-06-19T03:00:00.000Z';

function createClient(
  overrides: Partial<ConstructorParameters<typeof MqttClient>[0]> = {},
): MqttClient {
  return new MqttClient({
    clientId: 'mqtt-client-test',
    locationId: LOCATION_ID,
    url: 'ws://localhost.test/mqtt',
    reconnectEnabled: true,
    reconnectDelayMs: 1_000,
    ...overrides,
  });
}

function createQueueCallEvent(eventId = 'event-call-1'): QueueCallEvent {
  return {
    eventId,
    eventType: 'QUEUE_CALL',
    locationId: LOCATION_ID,
    timestamp: TIMESTAMP,
    payload: {
      ticketId: 'ticket-1',
      ticketNumber: 'A001',
      counterId: 'counter-1',
      counterName: 'Quay 01',
    },
  };
}

function createAudioPlayEvent(): AudioPlayEvent {
  return {
    eventId: 'event-audio-1',
    eventType: 'AUDIO_PLAY',
    locationId: LOCATION_ID,
    timestamp: TIMESTAMP,
    payload: {
      ticketNumber: 'A001',
      counterName: 'Quay 01',
      outputMode: 'SERVER_SPEAKER',
      announcementText: 'Moi so A001 den quay 01',
    },
  };
}

function createDisplayUpdateEvent(): DisplayUpdateEvent {
  return {
    eventId: 'event-display-1',
    eventType: 'DISPLAY_UPDATE',
    locationId: LOCATION_ID,
    timestamp: TIMESTAMP,
    payload: {
      state: {
        locationId: LOCATION_ID,
        currentTicket: null,
        waitingTickets: [],
        updatedAt: TIMESTAMP,
      },
    },
  };
}

describe('MqttClient', () => {
  it('moves through CONNECTING to CONNECTED', async () => {
    const client = createClient();
    const statuses: string[] = [];
    client.onStatusChange((status) => statuses.push(status));

    await client.connect();

    expect(statuses).toEqual(['CONNECTING', 'CONNECTED']);
    expect(client.status).toBe('CONNECTED');
  });

  it('moves to DISCONNECTED', async () => {
    const client = createClient();
    await client.connect();

    await client.disconnect();

    expect(client.status).toBe('DISCONNECTED');
  });

  it('blocks new events as soon as disconnect starts', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();

    const disconnectPromise = client.disconnect();
    const result = client.injectTestEvent(MQTT_TOPICS.queueCall, createQueueCallEvent());

    expect(client.status).toBe('DISCONNECTED');
    expect(result).toBe('DISCONNECTED');
    expect(handler).not.toHaveBeenCalled();
    await disconnectPromise;
  });

  it('delivers a valid subscribed event', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();

    const result = client.injectTestEvent(MQTT_TOPICS.queueCall, createQueueCallEvent());

    expect(result).toBe('DELIVERED');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects an event with an invalid schema', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();

    const invalidEvent = { ...createQueueCallEvent(), payload: { ticketId: 'ticket-1' } };
    const result = client.injectTestEvent(MQTT_TOPICS.queueCall, invalidEvent);

    expect(result).toBe('INVALID_EVENT');
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers a duplicate eventId only once', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();
    const event = createQueueCallEvent('duplicate-event');

    expect(client.injectTestEvent(MQTT_TOPICS.queueCall, event)).toBe('DELIVERED');
    expect(client.injectTestEvent(MQTT_TOPICS.queueCall, event)).toBe('DUPLICATE_EVENT');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retains duplicate eventIds after disconnect and reconnect', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();
    const event = createQueueCallEvent('reconnected-duplicate');

    expect(client.injectTestEvent(MQTT_TOPICS.queueCall, event)).toBe('DELIVERED');
    await client.disconnect();
    await client.connect();

    expect(client.injectTestEvent(MQTT_TOPICS.queueCall, event)).toBe('DUPLICATE_EVENT');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects an event from another location', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();
    const event = { ...createQueueCallEvent(), locationId: 'another-location' };

    expect(client.injectTestEvent(MQTT_TOPICS.queueCall, event)).toBe('LOCATION_MISMATCH');
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivery after unsubscribe', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    const subscription = client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();
    client.unsubscribe(subscription);

    const result = client.injectTestEvent(MQTT_TOPICS.queueCall, createQueueCallEvent());

    expect(result).toBe('NO_SUBSCRIBERS');
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers a valid AudioPlayEvent', async () => {
    const client = createClient();
    const handler = vi.fn<(event: AudioPlayEvent) => void>();
    client.subscribe(MQTT_TOPICS.audioPlay, isAudioPlayEvent, handler);
    await client.connect();

    expect(client.injectTestEvent(MQTT_TOPICS.audioPlay, createAudioPlayEvent())).toBe('DELIVERED');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers a valid DisplayUpdateEvent', async () => {
    const client = createClient();
    const handler = vi.fn<(event: DisplayUpdateEvent) => void>();
    client.subscribe(MQTT_TOPICS.displayUpdate, isDisplayUpdateEvent, handler);
    await client.connect();

    expect(client.injectTestEvent(MQTT_TOPICS.displayUpdate, createDisplayUpdateEvent())).toBe(
      'DELIVERED',
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers a valid QueueCallEvent', async () => {
    const client = createClient();
    const handler = vi.fn<(event: QueueCallEvent) => void>();
    client.subscribe(MQTT_TOPICS.queueCall, isQueueCallEvent, handler);
    await client.connect();

    expect(client.injectTestEvent(MQTT_TOPICS.queueCall, createQueueCallEvent())).toBe('DELIVERED');
    expect(handler).toHaveBeenCalledWith(createQueueCallEvent());
  });

  it('moves to ERROR when connection configuration is invalid', async () => {
    const client = createClient({ url: '' });

    await expect(client.connect()).rejects.toMatchObject({ kind: 'CONFIGURATION_ERROR' });
    expect(client.status).toBe('ERROR');
  });
});
