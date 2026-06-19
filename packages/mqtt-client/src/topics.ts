/**
 * BACKEND_CONFIRMATION_REQUIRED: These DRAFT topic candidates are not official Backend
 * contracts. Consumers should keep topic selection outside UI components.
 */
export const MQTT_TOPICS = {
  queueCall: 'hcc/queue/call',
  audioPlay: 'hcc/audio/play',
  displayUpdate: 'hcc/display/update',
} as const;

/** PROVISIONAL: Counter-specific topic syntax requires Backend confirmation. */
export function getCounterEventsTopic(counterId: string): string {
  return `hcc/counter/${encodeURIComponent(counterId)}/events`;
}
