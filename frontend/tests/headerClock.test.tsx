import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Header } from '../src/components/layout/Header';

describe('Header Live Clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    title: 'Test Title',
    description: 'Test Description',
    isOnline: true,
    isLoading: false,
    isRefreshing: false,
    lastFetchedAt: new Date(2026, 9, 22, 10, 0, 0),
    observationWindow: '7d' as const,
    onWindowChange: vi.fn(),
    onRefresh: vi.fn(),
    onToggleMobileMenu: vi.fn(),
  };

  it('renders initial clock time based on system clock', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 14, 30, 45));
    const { container } = render(<Header {...defaultProps} />);

    const clockContainer = container.querySelector('.header-sync-time');
    expect(clockContainer).toBeInTheDocument();

    const expectedInitialTime = new Date(2026, 9, 22, 14, 30, 45).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    expect(clockContainer?.textContent).toContain(expectedInitialTime);
  });

  it('updates the displayed clock time every second without calling onRefresh', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 14, 30, 45));
    const onRefreshMock = vi.fn();
    const { container } = render(<Header {...defaultProps} onRefresh={onRefreshMock} />);

    const clockContainer = container.querySelector('.header-sync-time');

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const expectedAfter1s = new Date(2026, 9, 22, 14, 30, 46).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    expect(clockContainer?.textContent).toContain(expectedAfter1s);
    expect(onRefreshMock).not.toHaveBeenCalled();

    // Advance 5 more seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const expectedAfter6s = new Date(2026, 9, 22, 14, 30, 51).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    expect(clockContainer?.textContent).toContain(expectedAfter6s);
    expect(onRefreshMock).not.toHaveBeenCalled();
  });

  it('cleans up interval on unmount to prevent memory leaks', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<Header {...defaultProps} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('preserves tooltip showing last data sync time independently of clock', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 14, 30, 45));
    const syncTime = new Date(2026, 9, 22, 12, 15, 0);
    const { container } = render(<Header {...defaultProps} lastFetchedAt={syncTime} />);

    const clockContainer = container.querySelector('.header-sync-time');
    const expectedSyncString = syncTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    expect(clockContainer).toHaveAttribute('title', `Last data sync: ${expectedSyncString}`);

    // Advance clock by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Tooltip remains unchanged while clock advances
    expect(clockContainer).toHaveAttribute('title', `Last data sync: ${expectedSyncString}`);
  });
});
