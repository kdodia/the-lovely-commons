import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Avatar from './Avatar.svelte';

describe('Avatar', () => {
	it('renders a plain image with the given source and alt text', () => {
		render(Avatar, { props: { src: 'https://example.com/a.png', alt: 'Sarah Chen' } });
		const img = screen.getByAltText('Sarah Chen');
		expect(img.tagName).toBe('IMG');
		expect(img).toHaveAttribute('src', 'https://example.com/a.png');
	});

	it('sizes and rings the picture through CSS variables', () => {
		render(Avatar, { props: { src: 'x.png', alt: 'A', size: '60px', border: '2px' } });
		const style = screen.getByAltText('A').getAttribute('style');
		expect(style).toContain('--avatar-size: 60px');
		expect(style).toContain('--avatar-border: 2px');
	});

	it('has no ring by default', () => {
		render(Avatar, { props: { src: 'x.png', alt: 'A' } });
		expect(screen.getByAltText('A').getAttribute('style')).toContain('--avatar-border: 0px');
	});

	it('uses a placeholder instead of a broken image when fallback is on and there is no source', () => {
		render(Avatar, { props: { src: undefined, alt: 'Nobody', fallback: true } });
		expect(screen.getByRole('img', { name: 'Nobody' })).toBeInTheDocument();
		expect(screen.getByText('👤')).toBeInTheDocument();
	});

	it('shows the picture inside the fallback wrapper when a source exists', () => {
		const { container } = render(Avatar, { props: { src: 'x.png', alt: 'A', fallback: true } });
		expect(container.querySelector('.fallback img')).toHaveAttribute('src', 'x.png');
	});
});
