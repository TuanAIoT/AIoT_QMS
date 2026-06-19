import {
  isAudioPlayEvent,
  isDeviceHeartbeatEvent,
  isDisplayUpdateEvent,
  isQueueCallEvent,
  isQueueFinishEvent,
  isQueueRecallEvent,
  isQueueTransferEvent,
  type AudioPlayEvent,
  type DeviceHeartbeatEvent,
  type DisplayUpdateEvent,
  type EventId,
  type QueueCallEvent,
  type QueueFinishEvent,
  type QueueRecallEvent,
  type QueueTransferEvent,
} from '@qms/contracts';
import { MQTT_TOPICS } from '@qms/mqtt-client';

export type SimulatorEvent =
  | QueueCallEvent
  | QueueRecallEvent
  | QueueTransferEvent
  | QueueFinishEvent
  | DisplayUpdateEvent
  | AudioPlayEvent
  | DeviceHeartbeatEvent;

export type SimulatorTopic = (typeof MQTT_TOPICS)[keyof typeof MQTT_TOPICS];
export type SimulatorEventHandler = (event: SimulatorEvent) => void;

export interface SimulatorSubscription {
  readonly id: string;
  readonly topic: SimulatorTopic;
}

export const SIMULATOR_PUBLISH_RESULTS = [
  'PUBLISHED',
  'INVALID_EVENT',
  'DUPLICATE_EVENT',
  'HANDLER_ERROR',
] as const;
export type SimulatorPublishResult = (typeof SIMULATOR_PUBLISH_RESULTS)[number];

interface StoredSubscription {
  readonly subscription: SimulatorSubscription;
  readonly handler: SimulatorEventHandler;
}

function validateEvent(topic: SimulatorTopic, value: unknown): value is SimulatorEvent {
  switch (topic) {
    case MQTT_TOPICS.queueCall:
      return isQueueCallEvent(value);
    case MQTT_TOPICS.queueRecall:
      return isQueueRecallEvent(value);
    case MQTT_TOPICS.queueTransfer:
      return isQueueTransferEvent(value);
    case MQTT_TOPICS.queueFinish:
      return isQueueFinishEvent(value);
    case MQTT_TOPICS.displayUpdate:
      return isDisplayUpdateEvent(value);
    case MQTT_TOPICS.audioPlay:
      return isAudioPlayEvent(value);
    case MQTT_TOPICS.deviceHeartbeat:
      return isDeviceHeartbeatEvent(value);
  }
}

export class MqttSimulator {
  private readonly processedEventIds = new Set<EventId>();
  private readonly subscriptions = new Map<string, StoredSubscription>();
  private nextSubscriptionId = 1;

  subscribe(topic: SimulatorTopic, handler: SimulatorEventHandler): SimulatorSubscription {
    const subscription: SimulatorSubscription = {
      id: `simulator-subscription-${String(this.nextSubscriptionId)}`,
      topic,
    };
    this.nextSubscriptionId += 1;
    this.subscriptions.set(subscription.id, { subscription, handler });
    return subscription;
  }

  unsubscribe(subscription: SimulatorSubscription): void {
    this.subscriptions.delete(subscription.id);
  }

  publish(topic: SimulatorTopic, value: unknown): SimulatorPublishResult {
    if (!validateEvent(topic, value)) {
      return 'INVALID_EVENT';
    }
    if (this.processedEventIds.has(value.eventId)) {
      return 'DUPLICATE_EVENT';
    }

    let hasHandlerError = false;
    for (const { subscription, handler } of this.subscriptions.values()) {
      if (subscription.topic === topic) {
        try {
          handler(value);
        } catch {
          hasHandlerError = true;
        }
      }
    }

    if (hasHandlerError) {
      return 'HANDLER_ERROR';
    }

    this.processedEventIds.add(value.eventId);
    return 'PUBLISHED';
  }

  reset(): void {
    this.processedEventIds.clear();
    this.subscriptions.clear();
    this.nextSubscriptionId = 1;
  }
}
