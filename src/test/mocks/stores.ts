// Mock for $app/stores
import { writable, readable } from 'svelte/store';

// `page` is writable so route tests can set params for dynamic routes
// (e.g. /items/[id]): page.set({ ...defaultPage, params: { id: 'item1' } })
export const defaultPage = {
	url: new URL('http://localhost'),
	params: {} as Record<string, string>,
	route: { id: '/' },
	status: 200,
	error: null,
	data: {},
	form: null,
	state: {}
};

export const page = writable({ ...defaultPage });

export const navigating = readable(null);

export const updated = {
	...readable(false),
	check: async () => false
};
