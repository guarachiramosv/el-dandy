export type SearchField = {
  value?: string | number | null;
  weight?: number;
};

export const normalizeSearchText = (value?: string | number | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase()
    .trim();

const compactSearchText = (value: string) => value.replace(/\s+/g, '');

export const getSearchTerms = (query?: string | number | null) =>
  normalizeSearchText(query).split(/\s+/).filter(Boolean);

const allowedDistance = (term: string) => {
  if (term.length <= 2) return 0;
  if (term.length <= 5) return 1;
  if (term.length <= 8) return 2;
  return 3;
};

const levenshteinDistance = (left: string, right: string, maxDistance: number) => {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      const next = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
      current[j] = next;
      rowMin = Math.min(rowMin, next);
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }

  return previous[right.length];
};

const fuzzyTokenScore = (term: string, tokens: string[]) => {
  const maxDistance = allowedDistance(term);
  if (maxDistance === 0) return 0;

  return tokens.reduce((best, token) => {
    if (token.length <= 2) return best;
    const distance = levenshteinDistance(term, token, maxDistance);
    if (distance > maxDistance) return best;
    return Math.max(best, 22 - distance * 6);
  }, 0);
};

export const scoreSearchMatch = (query: string, fields: SearchField[]) => {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return 0;

  const preparedFields = fields
    .map((field) => {
      const normalized = normalizeSearchText(field.value);
      return {
        normalized,
        compact: compactSearchText(normalized),
        tokens: normalized.split(/\s+/).filter(Boolean),
        weight: field.weight ?? 1,
      };
    })
    .filter((field) => field.normalized.length > 0);

  if (preparedFields.length === 0) return null;

  let totalScore = 0;

  for (const term of terms) {
    const compactTerm = compactSearchText(term);
    let bestTermScore = 0;

    for (const field of preparedFields) {
      if (field.normalized === term || field.compact === compactTerm) {
        bestTermScore = Math.max(bestTermScore, 100 * field.weight);
        continue;
      }
      if (field.normalized.startsWith(term) || field.compact.startsWith(compactTerm)) {
        bestTermScore = Math.max(bestTermScore, 80 * field.weight);
        continue;
      }
      if (field.normalized.includes(term) || field.compact.includes(compactTerm)) {
        bestTermScore = Math.max(bestTermScore, 58 * field.weight);
        continue;
      }

      bestTermScore = Math.max(bestTermScore, fuzzyTokenScore(term, field.tokens) * field.weight);
    }

    if (bestTermScore <= 0) return null;
    totalScore += bestTermScore;
  }

  return totalScore;
};

export const filterAndSortBySearch = <T>(
  items: T[],
  query: string,
  getFields: (item: T) => SearchField[],
  getLabel?: (item: T) => string,
) => {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return items;

  return items
    .map((item, index) => {
      const score = scoreSearchMatch(query, getFields(item));
      return score === null ? null : { item, score, index };
    })
    .filter((entry): entry is { item: T; score: number; index: number } => Boolean(entry))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (getLabel) return getLabel(a.item).localeCompare(getLabel(b.item));
      return a.index - b.index;
    })
    .map((entry) => entry.item);
};
