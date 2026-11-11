import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RatingScore from './RatingScore.svelte';

describe('RatingScore', () => {
	it('shows a star and the score to one decimal', () => {
		const { container } = render(RatingScore, { props: { value: 4.5 } });
		expect(container.textContent?.trim()).toBe('⭐ 4.5');
	});

	it('pads whole numbers', () => {
		const { container } = render(RatingScore, { props: { value: 5 } });
		expect(container.textContent).toContain('5.0');
	});

	it('shows only the star when there is no value', () => {
		const { container } = render(RatingScore, { props: { value: undefined } });
		expect(container.textContent?.trim()).toBe('⭐');
	});

	it('hides the star glyph from assistive tech', () => {
		const { container } = render(RatingScore, { props: { value: 3 } });
		expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('⭐');
	});
});
