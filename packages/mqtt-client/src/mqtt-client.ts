import { isMqttEventEnvelope, type EventId } from '@qms/contracts';

import type { MqttClientConfig } from './config.js';
import type { MqttConnectionStatus, MqttConnectionStatusHandler } from './connection-status.js';
import { MqttClientError } from './errors.js';

export type MqttEventValidator<TEvent> = (value: unknown) => value is TEvent;
export type MqttEventHandler<TEvent> = (event: TEvent) => void;

export interface MqttSubscription {
  readonly id: string;
  readonly topic: string;
}

export const MQTT_DISPATCH_RESULTS = [
  'DELIVERED',
  'DISCONNECTED',
  'INVALID_EVENT',
  'LOCATION_MISMATCH',
  'DUPLICATE_EVENT',
  'NO_SUBSCRIBERS',
] as const;

export type MqttDispatchResult = (typeof MQTT_DISPATCH_RESULTS)[number];

interface StoredSubscription {
  readonly subscription: MqttSubscription;
  readonly dispatch: (value: unknown) => boolean;
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

export class MqttClient {
  private connectionStatus: MqttConnectionStatus = 'DISCONNECTED';
  // QoS 1 duplicates may be redelivered after reconnect, so this cache is retained for
  // the full lifetime of the MqttClient instance rather than cleared on disconnect.
  private readonly processedEventIds = new Set<EventId>();
  private readonly statusHandlers = new Set<MqttConnectionStatusHandler>();
  private readonly subscriptions = new Map<string, StoredSubscription>();
  private nextSubscriptionId = 1;

  constructor(private readonly config: MqttClientConfig) {}

  get status(): MqttConnectionStatus {
    return this.connectionStatus;
  }

  async connect(): Promise<void> {
    if (this.connectionStatus === 'CONNECTED' || this.connectionStatus === 'CONNECTING') {
      return;
    }

    this.setStatus('CONNECTING');
    try {
      this.validateConfig();
      await Promise.resolve();
      this.setStatus('CONNECTED');
    } catch (cause) {
      this.setStatus('ERROR');
      if (cause instanceof MqttClientError) {
        throw cause;
      }
      throw new MqttClientError('CONNECTION_ERROR', 'The MQTT client failed to connect.', cause);
    }
  }

  async disconnect(): Promise<void> {
    this.setStatus('DISCONNECTED');
    await Promise.resolve();
  }

  subscribe<TEvent>(
    topic: string,
    validator: MqttEventValidator<TEvent>,
    handler: MqttEventHandler<TEvent>,
  ): MqttSubscription {
    if (!isNonEmptyString(topic)) {
      throw new TypeError('MQTT subscription topic must not be empty.');
    }

    const subscription: MqttSubscription = {
      id: `subscription-${String(this.nextSubscriptionId)}`,
      topic,
    };
    this.nextSubscriptionId += 1;

    this.subscriptions.set(subscription.id, {
      subscription,
      dispatch: (value: unknown): boolean => {
        if (!validator(value)) {
          return false;
        }
        handler(value);
        return true;
      },
    });

    return subscription;
  }

  unsubscribe(subscription: MqttSubscription): void {
    this.subscriptions.delete(subscription.id);
  }

  onStatusChange(handler: MqttConnectionStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  injectTestEvent(topic: string, value: unknown): MqttDispatchResult {
    if (this.connectionStatus !== 'CONNECTED') {
      return 'DISCONNECTED';
    }

    if (!isMqttEventEnvelope(value)) {
      return 'INVALID_EVENT';
    }

    if (value.locationId !== this.config.locationId) {
      return 'LOCATION_MISMATCH';
    }

    if (this.processedEventIds.has(value.eventId)) {
      return 'DUPLICATE_EVENT';
    }

    const topicSubscriptions = [...this.subscriptions.values()].filter(
      ({ subscription }) => subscription.topic === topic,
    );
    if (topicSubscriptions.length === 0) {
      return 'NO_SUBSCRIBERS';
    }

    let delivered = false;
    for (const subscription of topicSubscriptions) {
      delivered = subscription.dispatch(value) || delivered;
    }

    if (!delivered) {
      return 'INVALID_EVENT';
    }

    this.processedEventIds.add(value.eventId);
    return 'DELIVERED';
  }

  private setStatus(status: MqttConnectionStatus): void {
    this.connectionStatus = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private validateConfig(): void {
    if (!isNonEmptyString(this.config.clientId)) {
      throw new MqttClientError('CONFIGURATION_ERROR', 'MQTT clientId must not be empty.');
    }
    if (!isNonEmptyString(this.config.locationId)) {
      throw new MqttClientError('CONFIGURATION_ERROR', 'MQTT locationId must not be empty.');
    }
    if (!isNonEmptyString(this.config.url)) {
      throw new MqttClientError('CONFIGURATION_ERROR', 'MQTT url must not be empty.');
    }
    if (!Number.isInteger(this.config.reconnectDelayMs) || this.config.reconnectDelayMs < 0) {
      throw new MqttClientError(
        'CONFIGURATION_ERROR',
        'MQTT reconnectDelayMs must be a non-negative integer.',
      );
    }
  }
}
