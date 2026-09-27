// Pure rendering helper: given a string and a set of {start, end} character
// ranges the SERVER already identified as matches, split the string into
// plain/highlighted segments for <mark> rendering. This performs no
// matching, searching, or ranking of its own -- it only renders ranges it
// was handed.
export function segmentText(text, ranges) {
  if (!ranges || ranges.length === 0) return [{ text, highlight: false }];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  sorted.forEach(({ start, end }) => {
    if (start > text.length || end <= cursor) return;
    const s = Math.max(start, cursor);
    const e = Math.min(end, text.length);
    if (s > cursor) segments.push({ text: text.slice(cursor, s), highlight: false });
    if (e > s) segments.push({ text: text.slice(s, e), highlight: true });
    cursor = Math.max(cursor, e);
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });
  return segments;
}

/**
 * All literal occurrences of `needle` within `text`. Mirrors the two real
 * matching switches the user already set in Advanced Search
 * (`caseSensitive`, `wholeWord` -- Api/routes/search.py's own options) so
 * the reader's highlight agrees with why the server matched the document,
 * without re-implementing ranking/relevance/fuzzy/expansion matching.
 */
export function findLiteralRanges(text, needle, { caseSensitive = false, wholeWord = false } = {}) {
  if (!needle || !needle.trim()) return [];
  const ranges = [];
  const haystack = caseSensitive ? text : text.toLowerCase();
  const q = caseSensitive ? needle : needle.toLowerCase();
  const isWordChar = (c) => !!c && /[\p{L}\p{N}_]/u.test(c);
  let from = 0;
  while (true) {
    const at = haystack.indexOf(q, from);
    if (at === -1) break;
    const end = at + q.length;
    if (!wholeWord || (!isWordChar(haystack[at - 1]) && !isWordChar(haystack[end]))) {
      ranges.push({ start: at, end });
    }
    from = at + q.length;
  }
  return ranges;
}
