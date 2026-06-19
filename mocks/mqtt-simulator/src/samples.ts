import type {
  AudioPlayEvent,
  DeviceHeartbeatEvent,
  DisplayUpdateEvent,
  QueueCallEvent,
  QueueFinishEvent,
  QueueRecallEvent,
  QueueTransferEvent,
} from '@qms/contracts';
import { DEMO_COUNTERS, DEMO_DEVICES, DEMO_LOCATION, DEMO_TICKETS } from '@qms/seed-data';

const SAMPLE_TIMESTAMP = '2026-06-18T08:15:00.000Z';

export function createSampleQueueCallEvent(eventId = 'sample-queue-call'): QueueCallEvent {
  return {
    eventId,
    eventType: 'QUEUE_CALL',
    locationId: DEMO_LOCATION.id,
    timestamp: SAMPLE_TIMESTAMP,
    payload: {
      ticketId: DEMO_TICKETS[0].id,
      ticketNumber: DEMO_TICKETS[0].ticketNumber,
      counterId: DEMO_COUNTERS[0].id,
      counterName: DEMO_COUNTERS[0].name,
    },
  };
}

export function createSampleQueueRecallEvent(eventId = 'sample-queue-recall'): QueueRecallEvent {
  return {
    ...createSampleQueueCallEvent(eventId),
    eventType: 'QUEUE_RECALL',
  };
}

export function createSampleQueueTransferEvent(
  eventId = 'sample-queue-transfer',
): QueueTransferEvent {
  return {
    eventId,
    eventType: 'QUEUE_TRANSFER',
    locationId: DEMO_LOCATION.id,
    timestamp: SAMPLE_TIMESTAMP,
    payload: {
      ticketId: DEMO_TICKETS[4].id,
      ticketNumber: DEMO_TICKETS[4].ticketNumber,
      fromCounterId: DEMO_COUNTERS[0].id,
      toCounterId: DEMO_COUNTERS[1].id,
    },
  };
}

export function createSampleQueueFinishEvent(eventId = 'sample-queue-finish'): QueueFinishEvent {
  return {
    eventId,
    eventType: 'QUEUE_FINISH',
    locationId: DEMO_LOCATION.id,
    timestamp: SAMPLE_TIMESTAMP,
    payload: {
      ticketId: DEMO_TICKETS[5].id,
      ticketNumber: DEMO_TICKETS[5].ticketNumber,
      counterId: DEMO_COUNTERS[0].id,
    },
  };
}

export function createSampleDisplayUpdateEvent(
  eventId = 'sample-display-update',
): DisplayUpdateEvent {
  return {
    eventId,
    eventType: 'DISPLAY_UPDATE',
    locationId: DEMO_LOCATION.id,
    timestamp: SAMPLE_TIMESTAMP,
    payload: {
      state: {
        locationId: DEMO_LOCATION.id,
        currentTicket: DEMO_TICKETS[1],
        waitingTickets: [DEMO_TICKETS[0]],
        updatedAt: SAMPLE_TIMESTAMP,
      },
    },
  };
}

export function createSampleAudioPlayEvent(eventId = 'sample-audio-play'): AudioPlayEvent {
  return {
    eventId,
    eventType: 'AUDIO_PLAY',
    locationId: DEMO_LOCATION.id,
    timestamp: SAMPLE_TIMESTAMP,
    payload: {
      ticketNumber: DEMO_TICKETS[0].ticketNumber,
      counterName: DEMO_COUNTERS[0].name,
      outputMode: 'SERVER_SPEAKER',
      announcementText: `Moi so ${DEMO_TICKETS[0].ticketNumber} den ${DEMO_COUNTERS[0].name}`,
    },
  };
}

export function createSampleDeviceHeartbeatEvent(
  eventId = 'sample-device-heartbeat',
): DeviceHeartbeatEvent {
  return {
    eventId,
    eventType: 'DEVICE_HEARTBEAT',
    locationId: DEMO_LOCATION.id,
    timestamp: SAMPLE_TIMESTAMP,
    payload: {
      deviceId: DEMO_DEVICES[0].id,
      status: DEMO_DEVICES[0].status,
    },
  };
}
