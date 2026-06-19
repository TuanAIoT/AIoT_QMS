import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App, APP_NAME } from './App';

describe(APP_NAME, () => {
  it('renders the application name and pending status', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain(APP_NAME);
    expect(markup).toContain('OWNER_PENDING / NOT_IN_PHASE_1');
  });
});
