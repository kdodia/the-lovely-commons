import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		alias: {
			$lib: '/src/lib',
			'$app/environment': '/src/test/mocks/environment.ts',
			'$app/stores': '/src/test/mocks/stores.ts',
			'$app/navigation': '/src/test/mocks/navigation.ts'
		},
		// Required for Svelte 5 - ensure browser build is used
		server: {
			deps: {
				inline: ['svelte']
			}
		}
	},
	// Browser resolve conditions are needed for Svelte 5 under jsdom, but only
	// while running Vitest (mode === 'test') — applying them to dev/build would
	// override Vite's default condition list for real builds.
	resolve: mode === 'test' ? { conditions: ['browser'] } : undefined
}));
