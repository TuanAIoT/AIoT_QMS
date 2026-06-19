export const MQTT_CLIENT_ERROR_KINDS = ['CONFIGURATION_ERROR', 'CONNECTION_ERROR'] as const;

export type MqttClientErrorKind = (typeof MQTT_CLIENT_ERROR_KINDS)[number];

export class MqttClientError extends Error {
  readonly kind: MqttClientErrorKind;

  constructor(kind: MqttClientErrorKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'MqttClientError';
    this.kind = kind;
  }
}
