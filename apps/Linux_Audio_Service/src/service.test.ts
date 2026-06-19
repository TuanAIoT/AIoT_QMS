import type { AudioPlayEvent } from '@qms/contracts';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { AudioDryRunProcessor, getStartupMessage, SERVICE_NAME } from './service.js';

const TIMESTAMP = '2026-06-19T08:00:00.000Z';

function createEvent(eventId = 'audio-event-001'): AudioPlayEvent {
  return {
    eventId,
    eventType: 'AUDIO_PLAY',
    locationId: 'location-demo-001',
    timestamp: TIMESTAMP,
    payload: {
      ticketNumber: 'A001',
      counterName: 'quầy 1',
      outputMode: 'SERVER_SPEAKER',
      announcementText: 'Mời số A001 đến quầy 1',
    },
  };
}

function createEventWithoutAnnouncement(eventId = 'audio-event-fallback'): unknown {
  const event = createEvent(eventId);
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    locationId: event.locationId,
    timestamp: event.timestamp,
    payload: {
      ticketNumber: 'A-001',
      counterName: 'Quầy 1',
      outputMode: event.payload.outputMode,
    },
  };
}

describe(SERVICE_NAME, () => {
  it('starts in dry-run mode', () => {
    expect(getStartupMessage()).toBe(`${SERVICE_NAME} dry-run mode`);
  });

  it('creates the expected announcement for a valid AudioPlayEvent', () => {
    const result = new AudioDryRunProcessor().process(createEvent());

    expect(result).toMatchObject({
      status: 'PROCESSED',
      announcement: 'Mời số A001 đến quầy 1',
    });
  });

  it('uses announcementText when the event supplies it', () => {
    const event = createEvent();
    const result = new AudioDryRunProcessor().process({
      ...event,
      payload: { ...event.payload, announcementText: 'Thông báo tùy chỉnh an toàn' },
    });

    expect(result).toMatchObject({
      status: 'PROCESSED',
      announcement: 'Thông báo tùy chỉnh an toàn',
    });
  });

  it('derives a fallback announcement when announcementText is absent in dry-run input', () => {
    const result = new AudioDryRunProcessor().process(createEventWithoutAnnouncement());

    expect(result).toMatchObject({
      status: 'PROCESSED',
      announcement: 'Mời số A001 đến quầy 1',
    });
  });

  it('rejects an event with an invalid schema', () => {
    const result = new AudioDryRunProcessor().process({ eventType: 'AUDIO_PLAY', payload: {} });

    expect(result).toEqual({ status: 'INVALID_EVENT' });
  });

  it('rejects PII and raw identity fields without storing them', () => {
    const event = createEvent();
    const processor = new AudioDryRunProcessor();
    const result = processor.process({
      ...event,
      payload: {
        ...event.payload,
        customerName: 'Dữ liệu phải bị từ chối',
        cccd: 'Dữ liệu định danh bị từ chối',
      },
    });

    expect(result).toEqual({ status: 'INVALID_EVENT' });
    expect(processor.history).toEqual([]);
  });

  it('rejects sensitive content embedded in announcementText', () => {
    const event = createEvent();
    const processor = new AudioDryRunProcessor();
    const result = processor.process({
      ...event,
      payload: {
        ...event.payload,
        announcementText: 'CCCD 012345678901 đến quầy 1',
      },
    });

    expect(result).toEqual({ status: 'INVALID_EVENT' });
    expect(processor.history).toEqual([]);
  });

  it('does not process a duplicate eventId twice', () => {
    const processor = new AudioDryRunProcessor();
    const event = createEvent();

    expect(processor.process(event).status).toBe('PROCESSED');
    expect(processor.process(event)).toEqual({ status: 'DUPLICATE_EVENT' });
    expect(processor.history).toHaveLength(1);
  });

  it('stores history only for valid events', () => {
    const processor = new AudioDryRunProcessor();

    processor.process({ eventType: 'AUDIO_PLAY', payload: {} });
    processor.process(createEvent('audio-event-valid'));

    expect(processor.history).toEqual([
      {
        eventId: 'audio-event-valid',
        announcement: 'Mời số A001 đến quầy 1',
        timestamp: TIMESTAMP,
      },
    ]);
  });

  it('has no audio, TTS, MQTT, WebSocket, or TCP runtime dependency', () => {
    const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const runtimeSources = [
      readFileSync(new URL('./service.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./index.ts', import.meta.url), 'utf8'),
    ].join('\n');

    expect(packageJson).not.toMatch(/"(mqtt|say|speaker|node-gtts|tts)"\s*:/i);
    expect(runtimeSources).not.toMatch(
      /from\s+['"]mqtt|new\s+WebSocket|createConnection|\.publish\s*\(|\.play\s*\(/i,
    );
  });
});
