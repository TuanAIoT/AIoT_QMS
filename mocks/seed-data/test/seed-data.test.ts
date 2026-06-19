import { isSurveyConfig, isTicketStatus, TICKET_STATUSES } from '@qms/contracts';
import { QMS_SEED_DATA } from '@qms/seed-data';
import { describe, expect, it } from 'vitest';

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys);
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue),
  ]);
}

describe('@qms/seed-data public export', () => {
  it('loads complete typed seed collections through the package name', () => {
    expect(QMS_SEED_DATA.locations).toHaveLength(1);
    expect(QMS_SEED_DATA.staff).toHaveLength(2);
    expect(QMS_SEED_DATA.services).toHaveLength(3);
    expect(QMS_SEED_DATA.counters).toHaveLength(3);
    expect(QMS_SEED_DATA.activeCounterSession.status).toBe('ACTIVE');
    expect(QMS_SEED_DATA.tickets.length).toBeGreaterThan(3);
    expect(QMS_SEED_DATA.devices.length).toBeGreaterThan(0);
  });

  it('contains no raw citizen identity field', () => {
    const forbiddenKeys = new Set([
      'cccd',
      'cccdnumber',
      'citizenidnumber',
      'identitynumber',
      'citizenhash',
    ]);
    const normalizedKeys = collectObjectKeys(QMS_SEED_DATA).map((key) => key.toLowerCase());

    expect(normalizedKeys.some((key) => forbiddenKeys.has(key))).toBe(false);
  });

  it('uses only TicketStatus values exported by @qms/contracts', () => {
    expect(QMS_SEED_DATA.tickets.every((ticket) => isTicketStatus(ticket.status))).toBe(true);
    expect(TICKET_STATUSES).toContain(QMS_SEED_DATA.tickets[0].status);
  });

  it('uses a positive integer survey timeout accepted by the public validator', () => {
    expect(isSurveyConfig(QMS_SEED_DATA.surveyConfig)).toBe(true);
    expect(Number.isInteger(QMS_SEED_DATA.surveyConfig.surveyTimeoutSeconds)).toBe(true);
    expect(QMS_SEED_DATA.surveyConfig.surveyTimeoutSeconds).toBeGreaterThan(0);
  });
});
