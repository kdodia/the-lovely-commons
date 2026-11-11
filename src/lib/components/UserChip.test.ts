import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import UserChip from './UserChip.svelte';

describe('UserChip', () => {
	it('links to the profile and shows the name', () => {
		render(UserChip, { props: { userId: 'user2', name: 'Marcus Johnson', src: 'm.png' } });
		const link = screen.getByRole('link', { name: /Marcus Johnson/ });
		expect(link).toHaveAttribute('href', '/profile/user2');
		expect(screen.getByText('Marcus Johnson')).toBeInTheDocument();
	});

	it('shows the avatar with the name as alt text', () => {
		render(UserChip, { props: { userId: 'user2', name: 'Marcus Johnson', src: 'm.png' } });
		expect(screen.getByAltText('Marcus Johnson')).toHaveAttribute('src', 'm.png');
	});

	it('uses the placeholder avatar when fallback is on and the picture is missing', () => {
		render(UserChip, { props: { userId: 'u', name: 'No Pic', src: undefined, fallback: true } });
		expect(screen.getByText('👤')).toBeInTheDocument();
	});
});
