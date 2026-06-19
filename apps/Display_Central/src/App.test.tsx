// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App, APP_NAME } from './App';

describe(APP_NAME, () => {
  afterEach(() => cleanup());

  it('renders the empty state', () => {
    render(<App />);

    expect(screen.getByText('Chưa có số đang gọi')).toBeTruthy();
    expect(screen.getByText('Chưa có lịch sử gọi số.')).toBeTruthy();
  });

  it('shows ticket and counter for a valid QueueCallEvent', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue Call' }));

    const current = screen.getByRole('region', { name: 'Số đang gọi' });
    expect(within(current).getByText('A-101')).toBeTruthy();
    expect(within(current).getByText('Quầy Demo 01')).toBeTruthy();
  });

  it('shows recall status for a valid QueueRecallEvent', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue Recall' }));

    const current = screen.getByRole('region', { name: 'Số đang gọi' });
    expect(within(current).getByText('GỌI LẠI')).toBeTruthy();
  });

  it('clears the current ticket for a matching QueueFinishEvent', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Queue Call' }));

    fireEvent.click(screen.getByRole('button', { name: 'Queue Finish' }));

    expect(screen.getByText('Chưa có số đang gọi')).toBeTruthy();
    expect(screen.getByText('HOÀN THÀNH')).toBeTruthy();
  });

  it('rejects an event containing PII and never renders its values', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử event PII sai' }));

    expect(screen.getByRole('alert')).toHaveProperty(
      'textContent',
      'Event không hợp lệ đã bị từ chối.',
    );
    expect(screen.queryByText('Dữ liệu không được hiển thị')).toBeNull();
    expect(screen.queryByText('Dữ liệu bị từ chối')).toBeNull();
    expect(screen.getByText('Chưa có số đang gọi')).toBeTruthy();
  });

  it('does not contain broker transport or publish calls', () => {
    expect(App.toString()).not.toMatch(/new\s+WebSocket|publish\s*\(/i);
  });
});
