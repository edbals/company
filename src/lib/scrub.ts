// Pure helpers for Forget/Correct: find every other copy of a forgotten fact so the server can remove it.

const MIN_NAME_LENGTH = 2;
const REDACTED_NAME = "a friend";

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wholeWord = (term: string): RegExp =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term)}(?=$|[^\\p{L}\\p{N}])`, "giu");

const mentions = (text: string, term: string): boolean => wholeWord(term.trim()).test(text);

/** Interests (from setup) that the forgotten fact text quotes; returns a new array without them. */
export function interestsWithout(interests: readonly string[], factText: string): string[] {
  return interests.filter((i) => i.trim().length === 0 || !mentions(factText, i));
}

/** Distinct friend names (case-insensitive) that appear as whole words in the fact text. */
export function namesMentioned(
  names: readonly (string | null | undefined)[],
  factText: string,
): string[] {
  const seen = new Set<string>();
  return names.filter((n): n is string => {
    if (!n || n.trim().length < MIN_NAME_LENGTH) return false;
    const key = n.trim().toLowerCase();
    if (seen.has(key) || !mentions(factText, n)) return false;
    seen.add(key);
    return true;
  });
}

/** Replaces whole-word copies of a name with a neutral phrase. */
export function redactName(text: string, name: string): string {
  return text.replace(wholeWord(name.trim()), (_m, lead: string) => `${lead}${REDACTED_NAME}`);
}
