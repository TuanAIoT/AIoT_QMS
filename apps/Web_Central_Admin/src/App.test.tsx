import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App, APP_NAME } from './App';

describe(APP_NAME, () => {
  it('renders the application name', () => {
    expect(renderToStaticMarkup(<App />)).toContain(APP_NAME);
  });
});
