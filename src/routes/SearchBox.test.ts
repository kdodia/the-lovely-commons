import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchBox from './SearchBox.svelte';
import type { Suggestion } from './search';

const candidates: Suggestion[] = [
  { text: 'Cordless Drill', type: 'item' },
  { text: 'Tools', type: 'category' },
  { text: 'drill-press', type: 'tag' }
];

describe('SearchBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('suggests matches once two characters are typed', async () => {
    render(SearchBox, { props: { query: '', candidates } });
    const input = screen.getByRole('combobox');

    await fireEvent.input(input, { target: { value: 'd' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await fireEvent.input(input, { target: { value: 'dri' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Cordless Drill')).toBeInTheDocument();
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
  });

  it('applies the typed query after a pause and the picked suggestion immediately', async () => {
    let applied = '';
    render(SearchBox, {
      props: {
        get query() {
          return applied;
        },
        set query(v: string) {
          applied = v;
        },
        candidates
      }
    });
    const input = screen.getByRole('combobox');

    await fireEvent.input(input, { target: { value: 'dri' } });
    expect(applied).toBe('');
    await vi.advanceTimersByTimeAsync(300);
    expect(applied).toBe('dri');

    await fireEvent.click(screen.getByRole('button', { name: /Cordless Drill/ }));
    expect(applied).toBe('Cordless Drill');
    expect((input as HTMLInputElement).value).toBe('Cordless Drill');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clears the box and the applied query together', async () => {
    let applied = '';
    render(SearchBox, {
      props: {
        get query() {
          return applied;
        },
        set query(v: string) {
          applied = v;
        },
        candidates
      }
    });
    await fireEvent.input(screen.getByRole('combobox'), { target: { value: 'dri' } });
    await vi.advanceTimersByTimeAsync(300);
    await tick();

    await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(applied).toBe('');
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });
});
