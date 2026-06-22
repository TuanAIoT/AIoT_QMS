// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, APP_NAME } from './App';
import {
  initializeZaloRuntime,
  isBrowserDevelopmentEnabled,
  type ZaloRuntimeState,
} from './runtime';

const BROWSER_READY: ZaloRuntimeState = {
  phase: 'ready',
  runtime: 'browser-development',
};

function initializeBrowser(): Promise<ZaloRuntimeState> {
  return Promise.resolve(BROWSER_READY);
}

describe(APP_NAME, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the Vietnamese app shell in a browser test environment', async () => {
    render(<App initializeRuntime={initializeBrowser} />);

    expect(screen.getByRole('heading', { name: APP_NAME })).toBeTruthy();
    expect(screen.getByText('Điểm phục vụ')).toBeTruthy();
    expect(screen.getByText('Dịch vụ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lấy số thứ tự' })).toHaveProperty('disabled', true);
    await waitFor(() =>
      expect(screen.getByText('Chế độ phát triển trên trình duyệt.')).toBeTruthy(),
    );
  });

  it('does not crash when the Zalo SDK runtime is unavailable in browser development', async () => {
    const state = await initializeZaloRuntime({ browserDevelopmentEnabled: true }, () => {
      throw new Error('Zalo bridge unavailable');
    });

    expect(state).toEqual(BROWSER_READY);
  });

  it('handles a rejected or timed-out SDK runtime lookup safely', async () => {
    const rejected = await initializeZaloRuntime({ browserDevelopmentEnabled: false }, () =>
      Promise.reject(new Error('Zalo bridge rejected')),
    );
    const timedOut = await initializeZaloRuntime(
      { browserDevelopmentEnabled: false, systemInfoTimeoutMs: 1 },
      () => new Promise(() => undefined),
    );

    expect(rejected).toEqual({ phase: 'unsupported' });
    expect(timedOut).toEqual({ phase: 'unsupported' });
  });

  it('does not enable browser fallback in a production build', () => {
    expect(isBrowserDevelopmentEnabled(false, 'true')).toBe(false);
    expect(isBrowserDevelopmentEnabled(true, 'true')).toBe(true);
  });

  it('shows a safe configuration error', async () => {
    const initializeConfigurationError = (): Promise<ZaloRuntimeState> =>
      Promise.resolve({ phase: 'configuration-error' });

    render(<App initializeRuntime={initializeConfigurationError} />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveProperty(
        'textContent',
        'Cấu hình Zalo Mini App chưa đầy đủ.',
      ),
    );
  });

  it('requires a configured Mini App ID only for a detected Zalo runtime', async () => {
    const state = await initializeZaloRuntime({ browserDevelopmentEnabled: false }, () => ({
      platform: 'android',
      apiVersion: '2.51.4',
    }));

    expect(state).toEqual({ phase: 'configuration-error' });
  });

  it('does not call identity, profile, phone, or permission APIs', () => {
    const runtimeSource = readFileSync('src/runtime.ts', 'utf8');

    expect(runtimeSource).toContain('getSystemInfo');
    expect(runtimeSource).not.toMatch(
      /getUserInfo|getPhoneNumber|getUserID|authorize|getAccessToken|getAuthCode|requestPermission/i,
    );
  });

  it('does not request a Local or Central Server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<App initializeRuntime={initializeBrowser} />);

    await waitFor(() =>
      expect(screen.getByText('Chế độ phát triển trên trình duyệt.')).toBeTruthy(),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not render citizen identity or contact data', async () => {
    const { container } = render(<App initializeRuntime={initializeBrowser} />);
    await waitFor(() =>
      expect(screen.getByText('Chế độ phát triển trên trình duyệt.')).toBeTruthy(),
    );

    expect(container.textContent).not.toMatch(/cccd|căn cước|số điện thoại|email|@/i);
  });

  it('keeps backend-dependent actions disabled and does not create a fake booking', async () => {
    render(<App initializeRuntime={initializeBrowser} />);
    const button = screen.getByRole('button', { name: 'Lấy số thứ tự' });

    fireEvent.click(button);

    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText('Chưa có lượt đang chờ')).toBeTruthy();
    expect(screen.queryByText(/đặt lịch thành công|lấy số thành công/i)).toBeNull();
  });
});
