export const MQTT_CONNECTION_STATUSES = [
  'DISCONNECTED',
  'CONNECTING',
  'CONNECTED',
  'RECONNECTING',
  'ERROR',
] as const;

export type MqttConnectionStatus = (typeof MQTT_CONNECTION_STATUSES)[number];
export type MqttConnectionStatusHandler = (status: MqttConnectionStatus) => void;
