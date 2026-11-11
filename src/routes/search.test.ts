import { describe, it, expect } from 'vitest';
import { fuzzyScore, searchSuggestions } from './search';

describe('fuzzyScore', () => {
  it('ranks exact, prefix, substring and word-start matches in that order', () => {
    expect(fuzzyScore('Drill', 'drill')).toBe(100);
    expect(fuzzyScore('Drill press', 'drill')).toBe(90);
    expect(fuzzyScore('Power drill', 'drill')).toBe(80);
    expect(fuzzyScore('Cordless drill', 'cor')).toBe(90);
  });

  it('matches characters in order and rejects the rest', () => {
    expect(fuzzyScore('Stand Mixer', 'smx')).toBeGreaterThan(50);
    expect(fuzzyScore('Stand Mixer', 'xs')).toBe(-1);
  });
});

describe('searchSuggestions', () => {
  const candidates = [
    { text: 'Camping Stove', type: 'item' as const },
    { text: 'Camping', type: 'category' as const },
    { text: 'camping', type: 'tag' as const },
    { text: 'Tent', type: 'item' as const }
  ];

  it('needs at least two characters', () => {
    expect(searchSuggestions(candidates, 'c')).toEqual([]);
    expect(searchSuggestions(candidates, '')).toEqual([]);
  });

  it('puts the best match first and keeps one entry per text', () => {
    expect(searchSuggestions(candidates, 'camping')).toEqual([
      { text: 'Camping', type: 'category' },
      { text: 'Camping Stove', type: 'item' }
    ]);
  });

  it('returns at most six', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ text: `Tool ${i}`, type: 'item' as const }));
    expect(searchSuggestions(many, 'tool')).toHaveLength(6);
  });
});
