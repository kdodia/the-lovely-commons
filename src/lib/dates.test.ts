import { describe, it, expect } from 'vitest';
import {
	toLocalISODate,
	parseLocalDate,
	todayLocalISO,
	addDays,
	startOfLocalDay,
	formatDisplayDate,
	rangesOverlap
} from './dates';

// These tests are meaningful in any timezone — run them with e.g.
// TZ=Pacific/Auckland and TZ=America/Los_Angeles to catch UTC-shift bugs.
describe('toLocalISODate', () => {
	it('formats a local date without UTC conversion', () => {
		// Local midnight — toISOString() would shift this a day east of UTC
		expect(toLocalISODate(new Date(2026, 6, 27))).toBe('2026-07-27');
	});

	it('pads single-digit months and days', () => {
		expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
	});

	it('round-trips with parseLocalDate', () => {
		const original = '2026-07-27';
		expect(toLocalISODate(parseLocalDate(original))).toBe(original);
	});
});

describe('parseLocalDate', () => {
	it('parses to local midnight, not UTC midnight', () => {
		const parsed = parseLocalDate('2026-07-27');
		expect(parsed.getFullYear()).toBe(2026);
		expect(parsed.getMonth()).toBe(6);
		expect(parsed.getDate()).toBe(27);
		expect(parsed.getHours()).toBe(0);
	});
});

describe('todayLocalISO', () => {
	it("matches today's local calendar day", () => {
		const now = new Date();
		expect(todayLocalISO()).toBe(toLocalISODate(now));
	});
});

describe('addDays', () => {
	it('adds days across month boundaries', () => {
		expect(toLocalISODate(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
	});

	it('subtracts days with negative input', () => {
		expect(toLocalISODate(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
	});

	it('does not mutate the input date', () => {
		const original = new Date(2026, 5, 15);
		addDays(original, 5);
		expect(original.getDate()).toBe(15);
	});
});

describe('startOfLocalDay', () => {
	it('strips the time component', () => {
		const midday = new Date(2026, 5, 15, 14, 30, 45);
		const start = startOfLocalDay(midday);
		expect(start.getHours()).toBe(0);
		expect(start.getMinutes()).toBe(0);
		expect(start.getDate()).toBe(15);
	});
});

describe('formatDisplayDate', () => {
	it('renders the stored calendar day, not a UTC-shifted one', () => {
		expect(formatDisplayDate('2026-07-27', { month: 'short', day: 'numeric' })).toBe('Jul 27');
	});
});

describe('rangesOverlap', () => {
	it('detects overlapping ranges', () => {
		expect(rangesOverlap('2026-01-10', '2026-01-15', '2026-01-14', '2026-01-20')).toBe(true);
	});

	it('detects containment', () => {
		expect(rangesOverlap('2026-01-01', '2026-01-31', '2026-01-10', '2026-01-12')).toBe(true);
	});

	it('treats shared endpoints as overlap (inclusive ranges)', () => {
		expect(rangesOverlap('2026-01-10', '2026-01-15', '2026-01-15', '2026-01-20')).toBe(true);
	});

	it('returns false for disjoint ranges', () => {
		expect(rangesOverlap('2026-01-10', '2026-01-15', '2026-01-16', '2026-01-20')).toBe(false);
	});

	it('handles single-day ranges', () => {
		expect(rangesOverlap('2026-01-10', '2026-01-10', '2026-01-10', '2026-01-10')).toBe(true);
		expect(rangesOverlap('2026-01-10', '2026-01-10', '2026-01-11', '2026-01-11')).toBe(false);
	});
});
