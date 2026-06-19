import {
  isAudioPlayEvent,
  isDeviceHeartbeatEvent,
  isDisplayUpdateEvent,
  isQueueCallEvent,
  isQueueFinishEvent,
  isQueueRecallEvent,
  isQueueTransferEvent,
} from '@qms/contracts';
import { MQTT_TOPICS } from '@qms/mqtt-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSampleAudioPlayEvent,
  createSampleDeviceHeartbeatEvent,
  createSampleDisplayUpdateEvent,
  createSampleQueueCallEvent,
  createSampleQueueFinishEvent,
  createSampleQueueRecallEvent,
  createSampleQueueTransferEvent,
  MqttSimulator,
  type SimulatorEvent,
} from '../src/index.js';

let simulator: MqttSimulator;

beforeEach(() => {
  simulator = new MqttSimulator();
});

describe('MqttSimulator', () => {
  it('delivers a valid event to a subscriber', () => {
    const handler = vi.fn<(event: SimulatorEvent) => void>();
    simulator.subscribe(MQTT_TOPICS.queueCall, handler);
    const event = createSampleQueueCallEvent();

    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('PUBLISHED');
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('rejects an invalid event schema', () => {
    const handler = vi.fn<(event: SimulatorEvent) => void>();
    simulator.subscribe(MQTT_TOPICS.queueCall, handler);
    const invalidEvent = { ...createSampleQueueCallEvent(), payload: { ticketId: 'ticket-1' } };

    expect(simulator.publish(MQTT_TOPICS.queueCall, invalidEvent)).toBe('INVALID_EVENT');
    expect(handler).not.toHaveBeenCalled();
  });

  it('processes a duplicate eventId only once', () => {
    const handler = vi.fn<(event: SimulatorEvent) => void>();
    simulator.subscribe(MQTT_TOPICS.queueCall, handler);
    const event = createSampleQueueCallEvent('duplicate-event');

    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('PUBLISHED');
    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('DUPLICATE_EVENT');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops delivery after unsubscribe', () => {
    const handler = vi.fn<(event: SimulatorEvent) => void>();
    const subscription = simulator.subscribe(MQTT_TOPICS.queueCall, handler);
    simulator.unsubscribe(subscription);

    expect(simulator.publish(MQTT_TOPICS.queueCall, createSampleQueueCallEvent())).toBe(
      'PUBLISHED',
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('reset clears subscribers and duplicate cache', () => {
    const oldHandler = vi.fn<(event: SimulatorEvent) => void>();
    const newHandler = vi.fn<(event: SimulatorEvent) => void>();
    const event = createSampleQueueCallEvent('reset-event');
    simulator.subscribe(MQTT_TOPICS.queueCall, oldHandler);
    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('PUBLISHED');

    simulator.reset();
    simulator.subscribe(MQTT_TOPICS.queueCall, newHandler);

    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('PUBLISHED');
    expect(oldHandler).toHaveBeenCalledTimes(1);
    expect(newHandler).toHaveBeenCalledTimes(1);
  });

  it('creates a valid QueueCallEvent sample', () => {
    expect(isQueueCallEvent(createSampleQueueCallEvent())).toBe(true);
  });

  it('creates a valid DisplayUpdateEvent sample without PII', () => {
    const event = createSampleDisplayUpdateEvent();

    expect(isDisplayUpdateEvent(event)).toBe(true);
    expect(JSON.stringify(event)).not.toMatch(
      /customerName|fullName|phone|email|address|citizenHash|cccd/i,
    );
  });

  it('creates a valid AudioPlayEvent sample without PII', () => {
    const event = createSampleAudioPlayEvent();

    expect(isAudioPlayEvent(event)).toBe(true);
    expect(JSON.stringify(event)).not.toMatch(
      /customerName|fullName|phone|email|address|citizenHash|cccd/i,
    );
  });

  it('does not deliver an event published on the wrong topic', () => {
    const handler = vi.fn<(event: SimulatorEvent) => void>();
    simulator.subscribe(MQTT_TOPICS.audioPlay, handler);

    expect(simulator.publish(MQTT_TOPICS.audioPlay, createSampleQueueCallEvent())).toBe(
      'INVALID_EVENT',
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers an event to every subscriber on the topic', () => {
    const firstHandler = vi.fn<(event: SimulatorEvent) => void>();
    const secondHandler = vi.fn<(event: SimulatorEvent) => void>();
    simulator.subscribe(MQTT_TOPICS.queueCall, firstHandler);
    simulator.subscribe(MQTT_TOPICS.queueCall, secondHandler);

    expect(simulator.publish(MQTT_TOPICS.queueCall, createSampleQueueCallEvent())).toBe(
      'PUBLISHED',
    );
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it('rejects PII added to DisplayUpdateEvent or AudioPlayEvent payloads', () => {
    const displayWithPii = {
      ...createSampleDisplayUpdateEvent(),
      payload: { ...createSampleDisplayUpdateEvent().payload, customerName: 'Sensitive' },
    };
    const audioWithPii = {
      ...createSampleAudioPlayEvent(),
      payload: { ...createSampleAudioPlayEvent().payload, citizenHash: 'forbidden' },
    };

    expect(simulator.publish(MQTT_TOPICS.displayUpdate, displayWithPii)).toBe('INVALID_EVENT');
    expect(simulator.publish(MQTT_TOPICS.audioPlay, audioWithPii)).toBe('INVALID_EVENT');
  });

  it('rejects PII added at the Display or Audio envelope level', () => {
    const displayWithPii = {
      ...createSampleDisplayUpdateEvent(),
      customerName: 'Sensitive',
    };
    const audioWithPii = {
      ...createSampleAudioPlayEvent(),
      cccd: 'prohibited',
    };

    expect(simulator.publish(MQTT_TOPICS.displayUpdate, displayWithPii)).toBe('INVALID_EVENT');
    expect(simulator.publish(MQTT_TOPICS.audioPlay, audioWithPii)).toBe('INVALID_EVENT');
  });

  it('continues dispatch and does not cache eventId when a handler throws', () => {
    const eventuallySuccessfulHandler = vi
      .fn<(event: SimulatorEvent) => void>()
      .mockImplementationOnce(() => {
        throw new Error('Expected handler failure');
      });
    const secondHandler = vi.fn<(event: SimulatorEvent) => void>();
    const event = createSampleQueueCallEvent('handler-error-event');
    simulator.subscribe(MQTT_TOPICS.queueCall, eventuallySuccessfulHandler);
    simulator.subscribe(MQTT_TOPICS.queueCall, secondHandler);

    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('HANDLER_ERROR');
    expect(secondHandler).toHaveBeenCalledTimes(1);

    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('PUBLISHED');
    expect(eventuallySuccessfulHandler).toHaveBeenCalledTimes(2);
    expect(secondHandler).toHaveBeenCalledTimes(2);

    expect(simulator.publish(MQTT_TOPICS.queueCall, event)).toBe('DUPLICATE_EVENT');
    expect(eventuallySuccessfulHandler).toHaveBeenCalledTimes(2);
    expect(secondHandler).toHaveBeenCalledTimes(2);
  });

  it('supports every required event contract and topic', () => {
    const cases = [
      [MQTT_TOPICS.queueRecall, createSampleQueueRecallEvent(), isQueueRecallEvent],
      [MQTT_TOPICS.queueTransfer, createSampleQueueTransferEvent(), isQueueTransferEvent],
      [MQTT_TOPICS.queueFinish, createSampleQueueFinishEvent(), isQueueFinishEvent],
      [MQTT_TOPICS.deviceHeartbeat, createSampleDeviceHeartbeatEvent(), isDeviceHeartbeatEvent],
    ] as const;

    for (const [topic, event, validator] of cases) {
      expect(validator(event)).toBe(true);
      expect(simulator.publish(topic, event)).toBe('PUBLISHED');
    }
  });
});
