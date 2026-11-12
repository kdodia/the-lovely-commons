import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createLoanActions } from './loanActions';
import { appStore } from '$lib/store';
import { baseState, request } from './testState';

describe('createLoanActions', () => {
  const notify = vi.fn();
  const actions = createLoanActions(notify);

  beforeEach(() => {
    notify.mockClear();
    appStore.replaceState(baseState({ borrowRequests: [request()] }));
  });

  it('approves a pending request and says the item is reserved', () => {
    actions.approve('req1');
    expect(get(appStore).borrowRequests[0].status).toBe('approved');
    expect(notify).toHaveBeenCalledWith('Request approved! Those dates are now reserved.', 'success');
  });

  it('declines a pending request', () => {
    actions.deny('req1');
    expect(get(appStore).borrowRequests[0].status).toBe('denied');
    expect(notify).toHaveBeenCalledWith('Request declined', 'info');
  });

  it('shows the store error when an action is refused', () => {
    actions.approve('missing');
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('says who the lender is still waiting for after the first pickup confirmation', () => {
    appStore.replaceState(baseState({ borrowRequests: [request({ status: 'approved' })] }));
    actions.confirmPickup('req1');
    expect(notify).toHaveBeenCalledWith('Pickup confirmed — waiting for Bo Borrower', 'success');
  });

  it('activates the loan on the second pickup confirmation', () => {
    appStore.replaceState(
      baseState({ borrowRequests: [request({ status: 'approved', pickupConfirmedBy: ['borrower'] })] })
    );
    actions.confirmPickup('req1');
    expect(get(appStore).borrowRequests[0].status).toBe('active');
    expect(notify).toHaveBeenCalledWith('Both sides confirmed — the loan is now active', 'success');
  });

  it('returns whether a message was accepted', () => {
    expect(actions.sendMessage('req1', 'Hello there')).toBe(true);
    expect(get(appStore).borrowRequests[0].messages?.[0].text).toBe('Hello there');
    expect(notify).not.toHaveBeenCalled();

    expect(actions.sendMessage('req1', '   ')).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
