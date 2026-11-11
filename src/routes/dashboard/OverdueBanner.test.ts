import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import OverdueBanner from './OverdueBanner.svelte';

describe('OverdueBanner', () => {
  it('renders nothing when no loans are overdue', () => {
    render(OverdueBanner, { props: { lentCount: 0, borrowedCount: 0, onShow: vi.fn() } });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the singular for one overdue loan and the plural for several', () => {
    render(OverdueBanner, { props: { lentCount: 1, borrowedCount: 3, onShow: vi.fn() } });
    expect(screen.getByRole('button', { name: '1 item you lent is overdue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 items you borrowed are overdue' })).toBeInTheDocument();
  });

  it('only links to the side that has overdue loans', () => {
    render(OverdueBanner, { props: { lentCount: 2, borrowedCount: 0, onShow: vi.fn() } });
    expect(screen.getByRole('button', { name: '2 items you lent are overdue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /borrowed/ })).not.toBeInTheDocument();
  });

  it('sends each link to its tab', async () => {
    const onShow = vi.fn();
    render(OverdueBanner, { props: { lentCount: 1, borrowedCount: 1, onShow } });

    await fireEvent.click(screen.getByRole('button', { name: /you lent/ }));
    expect(onShow).toHaveBeenLastCalledWith('lending');
    await fireEvent.click(screen.getByRole('button', { name: /you borrowed/ }));
    expect(onShow).toHaveBeenLastCalledWith('borrowing');
  });
});
