import type { LocationId } from '@qms/contracts';

export interface MqttClientConfig {
  readonly clientId: string;
  readonly locationId: LocationId;
  readonly url: string;
  readonly reconnectEnabled: boolean;
  readonly reconnectDelayMs: number;
}
