import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RequestCard from './RequestCard.svelte';
import { appStore } from '$lib/store';
import { baseState, request } from './testState';

describe('RequestCard', () => {
  beforeEach(() => {
    appStore.replaceState(baseState());
  });

  describe('as the lender (incoming request)', () => {
    it('shows who is asking, their note and approve / deny', async () => {
      const onApprove = vi.fn();
      const onDeny = vi.fn();
      render(RequestCard, { props: { request: request(), perspective: 'lender', onApprove, onDeny } });

      expect(screen.getByRole('heading', { name: 'Stand Mixer' })).toBeInTheDocument();
      expect(screen.getByText('Bo Borrower')).toBeInTheDocument();
      expect(screen.getByText('"Can I borrow this?"')).toBeInTheDocument();

      await fireEvent.click(screen.getByRole('button', { name: '✓ Approve' }));
      expect(onApprove).toHaveBeenCalledWith('req1');
      await fireEvent.click(screen.getByRole('button', { name: '✗ Deny' }));
      expect(onDeny).toHaveBeenCalledWith('req1');
    });

    it('drops the quoted note while the thread is open, since the thread shows it', () => {
      render(RequestCard, {
        props: { request: request(), perspective: 'lender', threadOpen: true }
      });
      expect(screen.queryByText('"Can I borrow this?"')).not.toBeInTheDocument();
    });
  });

  describe('as the borrower (my request)', () => {
    beforeEach(() => {
      appStore.replaceState(baseState({ currentUserId: 'borrower' }));
    });

    it('offers cancel on a pending request', async () => {
      const onCancel = vi.fn();
      render(RequestCard, { props: { request: request(), perspective: 'borrower', onCancel } });

      expect(screen.getByText('Requested from')).toBeInTheDocument();
      expect(screen.getByText('Lena Lender')).toBeInTheDocument();
      expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
      expect(onCancel).toHaveBeenCalledWith('req1');
    });

    it.each([
      ['approved', '✓ Approved — awaiting pickup'],
      ['active', '🔄 Borrowing now']
    ] as const)('links an %s request to the Borrowing tab', async (status, badge) => {
      const onManage = vi.fn();
      render(RequestCard, { props: { request: request({ status }), perspective: 'borrower', onManage } });

      expect(screen.getByText(badge)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel Request' })).not.toBeInTheDocument();
      await fireEvent.click(screen.getByRole('button', { name: 'Manage in Borrowing' }));
      expect(onManage).toHaveBeenCalled();
    });

    it.each([
      ['completed', '✓ Returned'],
      ['cancelled', 'Cancelled'],
      ['denied', '✗ Declined']
    ] as const)('shows a %s request with its badge and no actions', (status, badge) => {
      render(RequestCard, { props: { request: request({ status }), perspective: 'borrower' } });

      expect(screen.getByText(badge)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cancel|Manage|Approve/ })).not.toBeInTheDocument();
    });
  });
});
