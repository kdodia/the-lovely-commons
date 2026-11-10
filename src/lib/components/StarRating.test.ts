import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StarRating from './StarRating.svelte';

const starCount = (container: HTMLElement) => container.querySelectorAll('.star-row span').length;

describe('StarRating', () => {
	it('renders one star per whole point', () => {
		const { container } = render(StarRating, { props: { value: 4 } });
		expect(starCount(container)).toBe(4);
	});

	it('rounds fractions down', () => {
		const { container } = render(StarRating, { props: { value: 3.9 } });
		expect(starCount(container)).toBe(3);
	});

	it('clamps to 0-5 and tolerates missing values', () => {
		expect(starCount(render(StarRating, { props: { value: 9 } }).container)).toBe(5);
		expect(starCount(render(StarRating, { props: { value: -2 } }).container)).toBe(0);
		expect(starCount(render(StarRating, { props: { value: undefined } }).container)).toBe(0);
	});

	it('is exposed as an image when a label is given', () => {
		render(StarRating, { props: { value: 5, label: '5 out of 5 stars' } });
		expect(screen.getByRole('img', { name: '5 out of 5 stars' })).toBeInTheDocument();
	});

	it('has no role when unlabelled and passes through a title', () => {
		const { container } = render(StarRating, { props: { value: 2, title: 'Their review' } });
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(container.querySelector('.star-row')).toHaveAttribute('title', 'Their review');
	});

	it('hides the glyphs from assistive tech', () => {
		const { container } = render(StarRating, { props: { value: 2 } });
		container.querySelectorAll('.star-row span').forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
	});
});
