import type { AudioPlayEvent } from '@qms/contracts';

import { AudioDryRunProcessor, getStartupMessage } from './service.js';

function createDryRunSample(): AudioPlayEvent {
  return {
    eventId: `audio-dry-run-${String(Date.now())}`,
    eventType: 'AUDIO_PLAY',
    locationId: 'location-demo-001',
    timestamp: new Date().toISOString(),
    payload: {
      ticketNumber: 'A001',
      counterName: 'quầy 1',
      outputMode: 'SERVER_SPEAKER',
      announcementText: 'Mời số A001 đến quầy 1',
    },
  };
}

const processor = new AudioDryRunProcessor();
const result = processor.process(createDryRunSample());

console.log(getStartupMessage());
if (result.status === 'PROCESSED') {
  console.log(`[dry-run] ${result.announcement}`);
}
console.log(`[dry-run] processed announcements: ${String(processor.history.length)}`);
