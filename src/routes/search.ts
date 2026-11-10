/**
 * Fuzzy text matching for the Browse page's search box and its suggestions.
 * Returns a score (higher = better match), or -1 for no match.
 */
export function fuzzyScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 90;

  // Contains exact query
  if (lowerText.includes(lowerQuery)) return 80;

  // Word boundary match (query matches start of a word)
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) return 70;
  }

  // Fuzzy character matching
  let queryIdx = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let totalMatches = 0;

  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      queryIdx++;
      totalMatches++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
  }

  // All query characters must be found in order
  if (queryIdx < lowerQuery.length) return -1;

  // Score based on consecutive matches and coverage
  return 50 + (maxConsecutive / lowerQuery.length) * 20 + (totalMatches / lowerText.length) * 10;
}

export type SuggestionType = 'item' | 'category' | 'tag';
export type Suggestion = { text: string; type: SuggestionType };

const MAX_SUGGESTIONS = 6;

/**
 * The best matches for `query` among `candidates` (given in the order they
 * should win ties: items, then categories, then tags), best first, one per
 * distinct text, at most six. Needs a query of at least two characters.
 */
export function searchSuggestions(candidates: Suggestion[], query: string): Suggestion[] {
  if (!query || query.length < 2) return [];

  const lowerQuery = query.toLowerCase();
  const scored: Array<Suggestion & { score: number }> = [];
  for (const candidate of candidates) {
    const score = fuzzyScore(candidate.text, lowerQuery);
    if (score > 0) scored.push({ ...candidate, score });
  }

  // Sort by score and deduplicate
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((s) => {
      const key = s.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SUGGESTIONS)
    .map(({ text, type }) => ({ text, type }));
}
