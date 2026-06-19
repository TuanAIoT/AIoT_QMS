import { describe, expect, it } from 'vitest';

import { getStartupMessage, SERVICE_NAME } from './service.js';

describe(SERVICE_NAME, () => {
  it('returns the service name at startup', () => {
    expect(getStartupMessage()).toBe(SERVICE_NAME);
  });
});
