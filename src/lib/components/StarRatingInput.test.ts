import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StarRatingInput from './StarRatingInput.svelte';

function setup(value = 3) {
	return render(StarRatingInput, { props: { value, labelledby: 'rating-label' } });
}

const filled = () => screen.getAllByRole('radio').filter((s) => s.classList.contains('filled'));

describe('StarRatingInput', () => {
	it('renders five radio stars in a labelled radiogroup', () => {
		setup();
		expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-labelledby', 'rating-label');
		expect(screen.getAllByRole('radio')).toHaveLength(5);
	});

	it('marks only the current value as checked', () => {
		setup(4);
		expect(screen.getByRole('radio', { name: 'Rate 4 out of 5 stars' })).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByRole('radio', { name: 'Rate 3 out of 5 stars' })).toHaveAttribute('aria-checked', 'false');
	});

	it('fills every star up to the value', () => {
		setup(2);
		expect(filled()).toHaveLength(2);
	});

	it('selects a star on click', async () => {
		setup(3);
		await fireEvent.click(screen.getByRole('radio', { name: 'Rate 5 out of 5 stars' }));
		expect(screen.getByRole('radio', { name: 'Rate 5 out of 5 stars' })).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByRole('radio', { name: 'Rate 3 out of 5 stars' })).toHaveAttribute('aria-checked', 'false');
	});

	it('previews the hovered star without changing the value', async () => {
		setup(1);
		const five = screen.getByRole('radio', { name: 'Rate 5 out of 5 stars' });
		await fireEvent.mouseEnter(five);
		expect(filled()).toHaveLength(5);
		expect(screen.getByRole('radio', { name: 'Rate 1 out of 5 stars' })).toHaveAttribute('aria-checked', 'true');
		await fireEvent.mouseLeave(five);
		expect(filled()).toHaveLength(1);
	});
});
