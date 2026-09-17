import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToast } from './useToast.svelte';

describe('useToast', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('exposes the current toast through a live getter', () => {
		const toaster = useToast();
		expect(toaster.toast).toBeNull();

		toaster.showToast('Saved!', 'success');
		// Reading through the object stays reactive — destructuring `toast`
		// would have frozen it at null (the bug that hid dashboard toasts)
		expect(toaster.toast).toEqual({ message: 'Saved!', type: 'success' });
	});

	it('auto-clears after the duration', () => {
		const toaster = useToast();
		toaster.showToast('Hello', 'info', 1000);

		vi.advanceTimersByTime(999);
		expect(toaster.toast).not.toBeNull();

		vi.advanceTimersByTime(1);
		expect(toaster.toast).toBeNull();
	});

	it('showing a new toast restarts the timer', () => {
		const toaster = useToast();
		toaster.showToast('first', 'info', 1000);
		vi.advanceTimersByTime(800);

		toaster.showToast('second', 'info', 1000);
		vi.advanceTimersByTime(800);
		// The first toast's timer must not clear the second toast early
		expect(toaster.toast?.message).toBe('second');

		vi.advanceTimersByTime(200);
		expect(toaster.toast).toBeNull();
	});

	it('clearToast dismisses immediately and cancels the timer', () => {
		const toaster = useToast();
		toaster.showToast('Bye', 'success', 1000);

		toaster.clearToast();
		expect(toaster.toast).toBeNull();

		toaster.showToast('New', 'success', 1000);
		vi.advanceTimersByTime(500);
		// The cancelled first timer must not clear the new toast
		expect(toaster.toast?.message).toBe('New');
	});
});
