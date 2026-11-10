import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ReturnModal from './ReturnModal.svelte';
import { appStore } from '$lib/store';
import { baseState, request } from './testState';

function open(requestOverrides = {}) {
  appStore.replaceState(
    baseState({
      borrowRequests: [
        request({ status: 'active', pickupConfirmedBy: ['lender', 'borrower'], ...requestOverrides })
      ]
    })
  );
  const onClose = vi.fn();
  const notify = vi.fn();
  render(ReturnModal, { props: { loanId: 'req1', onClose, notify } });
  return { onClose, notify };
}

describe('ReturnModal', () => {
  beforeEach(() => {
    appStore.replaceState(baseState());
  });

  it('asks about the borrower and shows the item current condition', () => {
    open();
    expect(screen.getByText('How was lending to Bo Borrower?')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    // The condition picker stays hidden until the box is ticked.
    expect(screen.queryByRole('radiogroup', { name: 'Select new condition' })).not.toBeInTheDocument();
  });

  it('confirms with the default rating and no condition change', async () => {
    const { onClose, notify } = open();
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm Return' }));

    const request = get(appStore).borrowRequests[0];
    expect(request.returnConfirmedBy).toEqual(['lender']);
    expect(get(appStore).items[0].condition).toBe('good');
    expect(notify).toHaveBeenCalledWith(
      'Return confirmed — waiting for the borrower to confirm too.',
      'success'
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('sends the chosen rating, note and condition, and completes once the borrower already confirmed', async () => {
    const { onClose, notify } = open({ returnConfirmedBy: ['borrower'] });

    await fireEvent.click(screen.getByRole('radio', { name: 'Rate 3 out of 5 stars' }));
    await fireEvent.input(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Left it spotless' }
    });
    await fireEvent.click(screen.getByLabelText('Condition has changed'));
    await fireEvent.click(screen.getByRole('radio', { name: /Fair/ }));
    expect(screen.getByText(/downgrade the item's condition from Good to Fair/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm Return' }));

    const state = get(appStore);
    expect(state.borrowRequests.find((r) => r.id === 'req1')?.status).toBe('completed');
    expect(state.borrowHistory[0]).toMatchObject({
      borrowerRating: 3,
      borrowerReview: 'Left it spotless',
      conditionBefore: 'good',
      conditionAfter: 'fair'
    });
    expect(state.items[0].condition).toBe('fair');
    expect(notify).toHaveBeenCalledWith('Return complete! Condition updated to Fair.', 'success');
    expect(onClose).toHaveBeenCalled();
  });

  it('describes an upgrade differently from a downgrade', async () => {
    open();
    await fireEvent.click(screen.getByLabelText('Condition has changed'));
    await fireEvent.click(screen.getByRole('radio', { name: /Excellent/ }));
    expect(screen.getByText(/upgrade the item's condition to Excellent/)).toBeInTheDocument();
  });

  it('leaves the condition alone when the box is unticked after picking one', async () => {
    open();
    await fireEvent.click(screen.getByLabelText('Condition has changed'));
    await fireEvent.click(screen.getByRole('radio', { name: /Poor/ }));
    await fireEvent.click(screen.getByLabelText('Condition has changed'));
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm Return' }));

    expect(get(appStore).items[0].condition).toBe('good');
  });

  it('closes without confirming on Cancel', async () => {
    const { onClose } = open();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(get(appStore).borrowRequests[0].returnConfirmedBy ?? []).toEqual([]);
  });
});
