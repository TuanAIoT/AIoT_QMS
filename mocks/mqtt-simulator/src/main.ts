import { MQTT_TOPICS } from '@qms/mqtt-client';

import {
  createSampleAudioPlayEvent,
  createSampleDisplayUpdateEvent,
  createSampleQueueCallEvent,
} from './samples.js';
import { MqttSimulator, type SimulatorEvent, type SimulatorTopic } from './simulator.js';

const sampleName = process.argv[2] ?? 'queue-call';
let topic: SimulatorTopic;
let event: SimulatorEvent;

switch (sampleName) {
  case 'display-update':
    topic = MQTT_TOPICS.displayUpdate;
    event = createSampleDisplayUpdateEvent();
    break;
  case 'audio-play':
    topic = MQTT_TOPICS.audioPlay;
    event = createSampleAudioPlayEvent();
    break;
  case 'queue-call':
    topic = MQTT_TOPICS.queueCall;
    event = createSampleQueueCallEvent();
    break;
  default:
    throw new Error('Supported samples: queue-call, display-update, audio-play.');
}

const simulator = new MqttSimulator();
simulator.subscribe(topic, (receivedEvent) => {
  // Do not log event payloads; operational identifiers are sufficient for this development CLI.
  console.log(
    JSON.stringify({
      topic,
      eventId: receivedEvent.eventId,
      eventType: receivedEvent.eventType,
    }),
  );
});
console.log(`publishResult=${simulator.publish(topic, event)}`);
